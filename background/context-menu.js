/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  configs,
  handleMissingReceiverError
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Selections from '/common/selections.js';
import * as Commands from '/common/commands.js';
import * as DragSelection from '/common/drag-selection.js';
import * as SharedState from '/common/shared-state.js';

const mItems = `
  reloadTabs
  bookmarkTabs
  removeBookmarkFromTabs
  -----------------
  duplicateTabs
  -----------------
  pinTabs
  unpinTabs
  muteTabs
  unmuteTabs
  moveToNewWindow
  moveToOtherWindow
  -----------------
  removeTabs
  removeOther
  -----------------
  clipboard
  saveTabs
  -----------------
  printTabs
  -----------------
  freezeTabs
  unfreezeTabs
  protectTabs
  unprotectTabs
  lockTabs
  unlockTabs
  -----------------
  groupTabs
  -----------------
  suspendTabs
  resumeTabs
  -----------------
  selectAll
  select
  unselect
  invertSelection
  -----------------
`.trim().split(/\s+/).map(id => `selection/${id}`);
mItems.unshift('selection');

let mActiveItems = [];
const mExtraItems = {};

let mLastSubmenuVisible = false;

export function init() {
  reserveRefreshItems();
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  SharedState.onUpdated.addListener((windowId, extraInfo) => {
    if (extraInfo.updateMenu) {
      const tab = extraInfo.contextTab ? { id: extraInfo.contextTab, windowId } : null ;
      return refreshItems(tab, true);
    }
    else {
      reserveRefreshItems();
    }
  });
  configs.$addObserver(key => {
    if (/^(context_|copyToClipboardFormats)/.test(key))
      reserveRefreshItems();
  });
}


const POPUP_URL_PATTERN = [`moz-extension://${location.host}/*`];

let mLastSelectedTabs = '';

let mLastRefreshStart = Date.now();
const mUseNativeContextMenu = typeof browser.menus.overrideContext == 'function';
async function refreshItems(contextTab, force) {
  log('refreshItems');
  const currentRefreshStart = mLastRefreshStart = Date.now();
  const promisedMenuUpdated = [];

  if (reserveRefreshItems.timeout)
    clearTimeout(reserveRefreshItems.timeout);
  delete reserveRefreshItems.timeout;

  const currentWindow = await (contextTab ? browser.windows.get(contextTab.windowId) : browser.windows.getLastFocused());
  const selection = Selections.get(currentWindow.id);
  const serialized = JSON.stringify(selection.getSelectedTabs());
  if (!force &&
      serialized == mLastSelectedTabs) {
    log(' => no change, skip');
    return;
  }

  promisedMenuUpdated.push(browser.menus.removeAll());
  try {
    if (configs.enableIntegrationWithTST)
      promisedMenuUpdated.push(browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
      }).catch(handleMissingReceiverError));
  }
  catch(_e) {
  }
  if (currentRefreshStart != mLastRefreshStart)
    return;
  mActiveItems = [];
  mLastSelectedTabs       = serialized;
  const otherWindows = (await browser.windows.getAll())
    .filter(window => window.id != currentWindow.id && window.incognito == currentWindow.incognito);
  const visibilities = await getContextMenuItemVisibilities({
    tab:          contextTab,
    windowId:     currentWindow.id,
    otherWindows: otherWindows
  });
  if (currentRefreshStart != mLastRefreshStart)
    return;
  log('visibilities: ', visibilities);

  const hasSelection         = selection.getSelectedTabIds().length > 0;
  let separatorsCount      = 0;
  const normalItemAppearedIn = {};
  const createdItems         = {};
  const nextSeparatorIn      = {};
  const registerItem = async (id, options = {}) => {
    const parts = id.split('/');
    id = parts.pop();

    const parentId = parts.pop() || '';
    if (parentId && !(parentId in createdItems))
      return;

    const isSeparator = id.charAt(0) == '-';
    if (isSeparator) {
      if (!normalItemAppearedIn[parentId])
        return;
      normalItemAppearedIn[parentId] = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (id in visibilities && !visibilities[id])
        return;
      if (!options.always && !hasSelection)
        return;
      const key = `context_${id}`;
      if (configs[key] === false)
        return;
      normalItemAppearedIn[parentId] = true;
      if (nextSeparatorIn[parentId]) {
        mActiveItems.push(nextSeparatorIn[parentId]);
        if (mUseNativeContextMenu) {
          const params = nextSeparatorIn[parentId];
          promisedMenuUpdated.push(browser.menus.create(Object.assign({}, params, {
            id:        `panel_${params.id}`,
            parentId:  params.parentId == 'selection' ? null : `panel_${params.parentId}`,
            viewTypes: ['popup'],
            documentUrlPatterns: POPUP_URL_PATTERN
          })));
          promisedMenuUpdated.push(browser.menus.create(params));
        }
        else {
          promisedMenuUpdated.push(browser.menus.create(nextSeparatorIn[parentId]));
        }
        try {
          if (configs.enableIntegrationWithTST)
            promisedMenuUpdated.push(browser.runtime.sendMessage(Constants.kTST_ID, {
              type: Constants.kTSTAPI_CONTEXT_MENU_CREATE,
              params: nextSeparatorIn[parentId]
            }).catch(handleMissingReceiverError));
        }
        catch(_e) {
        }
      }
      delete nextSeparatorIn[parentId];
    }
    //log('build ', id, parentId);
    createdItems[id] = true;
    const type = isSeparator ? 'separator' : 'normal';
    let title = null;
    if (!isSeparator) {
      if (options.title)
        title = options.title;
      else
        title = browser.i18n.getMessage(`context_${id.replace(/[^a-z0-9@_]/gi, '_')}_label`);
    }
    const params = {
      id, type, title,
      contexts: ['page', 'tab']
    };
    if (parentId)
      params.parentId = parentId;
    if (isSeparator) {
      nextSeparatorIn[parentId] = params;
      return;
    }
    mActiveItems.push(params);
    if (mUseNativeContextMenu) {
      if (params.id == 'selection') {
        params.visible = false;
        mLastSubmenuVisible = false;
      }
      else {
        promisedMenuUpdated.push(browser.menus.create(Object.assign({}, params, {
          id:        `panel_${params.id}`,
          parentId:  params.parentId == 'selection' ? null : `panel_${params.parentId}`,
          viewTypes: ['popup'],
          documentUrlPatterns: POPUP_URL_PATTERN
        })));
      }
      promisedMenuUpdated.push(browser.menus.create(params));
    }
    else {
      promisedMenuUpdated.push(browser.menus.create(Object.assign({}, params, {
        // Access key is not supported by WE API.
        // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
        title: params.title && params.title.replace(/\(&[a-z]\)|&([a-z])/i, '$1')
      })));
    }
    try {
      if (configs.enableIntegrationWithTST)
        promisedMenuUpdated.push(browser.runtime.sendMessage(Constants.kTST_ID, {
          type: Constants.kTSTAPI_CONTEXT_MENU_CREATE,
          params
        }).catch(handleMissingReceiverError));
    }
    catch(_e) {
    }
  }

  for (const id of mItems) {
    await registerItem(id);
    if (currentRefreshStart != mLastRefreshStart)
      return;
  }

  // create submenu items for "copy to clipboard"
  let formatIds;
  const formats = configs.copyToClipboardFormats;
  if (Array.isArray(formats)) {
    formatIds = formats
      .map((item, index) => `clipboard/clipboard:${index}:${item.label}`)
      .filter((item, index) => formats[index].label);
  }
  else {
    const labels = Object.keys(formats);
    formatIds = labels
      .map((label, index) => `clipboard/clipboard:${index}:${label}`)
      .filter((item, index) => labels[index]);
  }
  for (const id of formatIds) {
    await registerItem(id, {
      title: id.replace(/^clipboard\/clipboard:[0-9]+:/, '')
    });
    if (currentRefreshStart != mLastRefreshStart)
      return;
  }

  // create submenu items for "move to other window"
  for (const window of otherWindows) {
    await registerItem(`moveToOtherWindow/moveToOtherWindow:${window.id}`, {
      title: window.title
    });
    if (currentRefreshStart != mLastRefreshStart)
      return;
  }

  // create additional items registered by other addons
  for (const id of Object.keys(mExtraItems)) {
    await registerItem(`selection/extra:${id}`, mExtraItems[id]);
    if (currentRefreshStart != mLastRefreshStart)
      return;
  }

  return Promise.all(promisedMenuUpdated);
}

export function reserveRefreshItems() {
  if (reserveRefreshItems.timeout)
    clearTimeout(reserveRefreshItems.timeout);
  reserveRefreshItems.timeout = setTimeout(() => {
    refreshItems();
  }, 150);
}

async function getContextMenuItemVisibilities(params) {
  const tab = params.tab;
  const selection = Selections.get(params.windowId);
  const allTabs = await selection.getAllTabs();
  let pinnedCount = 0;
  let mutedCount = 0;
  let suspendedCount = 0;
  let lockedCount = 0;
  let protectedCount = 0;
  let frozenCount = 0;
  const tabs = selection.getSelectedTabs();
  for (const tab of tabs) {
    if (tab.pinned)
      pinnedCount++;
    if (tab.mutedInfo.muted)
      mutedCount++;
    if (tab.discarded)
      suspendedCount++;
    if (tab.states && tab.states.indexOf('locked') < 0)
      lockedCount++;
    if (tab.states && tab.states.indexOf('protected') < 0)
      protectedCount++;
    if (tab.states && tab.states.indexOf('frozen') < 0)
      frozenCount++;
  }
  return {
    reloadTabs:    tabs.length > 0,
    bookmarkTabs:  tabs.length > 0,
    removeBookmarkFromTabs: tabs.length > 0,
    duplicateTabs: tabs.length > 0,
    pinTabs:       tabs.length > 0 && pinnedCount < tabs.length,
    unpinTabs:     tabs.length > 0 && pinnedCount > 0,
    muteTabs:      tabs.length > 0 && mutedCount < tabs.length,
    unmuteTabs:    tabs.length > 0 && mutedCount > 0,
    moveToNewWindow: tabs.length > 0,
    moveToOtherWindow: tabs.length > 0 && params.otherWindows.length > 0,
    removeTabs:    tabs.length > 0,
    removeOther:   tabs.length > 0 && tabs.length < allTabs.length,
    clipboard:     tabs.length > 0,
    saveTabs:      tabs.length > 0,
    printTabs:     tabs.length > 0,
    freezeTabs:    tabs.length > 0 && frozenCount < tabs.length,
    unfreezeTabs:  tabs.length > 0 && frozenCount > 0,
    protectTabs:   tabs.length > 0 && protectedCount < tabs.length,
    unprotectTabs: tabs.length > 0 && protectedCount > 0,
    lockTabs:      tabs.length > 0 && lockedCount < tabs.length,
    unlockTabs:    tabs.length > 0 && lockedCount > 0,
    groupTabs:     tabs.length > 1,
    suspendTabs:   tabs.length > 0 && suspendedCount < tabs.length,
    resumeTabs:    tabs.length > 0 && suspendedCount > 0,
    selectAll:     tabs.length < allTabs.length,
    select:        !tab || tabs.indexOf(tab.id) < 0,
    unselect:      !tab || tabs.indexOf(tab.id) > -1,
    invertSelection: tabs.length > 0
  };
}

/*
configs.$load().then(() => {
  refreshItems();
});

configs.$addObserver(key => {
  if (key.indexOf('context_') == 0)
    refreshItems();
});
*/

async function onClick(info, tab) {
  //log('context menu item clicked: ', info, tab);
  const selection = tab ? Selections.get(tab.windowId) : await Selections.getActive();
  const selectedTabIds = selection.getSelectedTabIds();
  console.log('info.menuItemId, selectedTabIds ', info.menuItemId, selectedTabIds);
  let shouldClearSelection = configs.clearSelectionAfterCommandInvoked;
  const itemId = info.menuItemId.replace(/^panel_/, '');
  switch (itemId) {
    case 'reloadTabs':
      await Commands.reloadTabs(selectedTabIds);
      break;
    case 'bookmarkTabs':
      await Commands.bookmarkTabs(selectedTabIds);
      break;
    case 'removeBookmarkFromTabs':
      // not implemented
      break;

    case 'duplicateTabs':
      await Commands.duplicateTabs(selectedTabIds);
      break;

    case 'pinTabs':
      await Commands.pinTabs(selectedTabIds);
      break;
    case 'unpinTabs':
      await Commands.unpinTabs(selectedTabIds);
      break;
    case 'muteTabs':
      await Commands.muteTabs(selectedTabIds);
      break;
    case 'unmuteTabs':
      await Commands.unmuteTabs(selectedTabIds);
      break;

    case 'moveToNewWindow':
      await Commands.moveToWindow(selectedTabIds);
      shouldClearSelection = false;
      break;

    case 'removeTabs':
      await Commands.removeTabs(selectedTabIds);
      break;
    case 'removeOther':
      await Commands.removeOtherTabs(selectedTabIds);
      break;

    case 'clipboard':
      break;
    case 'saveTabs':
      if (shouldClearSelection) {
        await selection.clear();
        await wait(100); // to wait tab titles are updated
      }
      await Commands.saveTabs(selectedTabIds);
      break;

    case 'printTabs':
      break;

    case 'freezeTabs':
    case 'unfreezeTabs':
    case 'protectTabs':
    case 'unprotectTabs':
    case 'lockTabs':
    case 'unlockTabs':
      break;

    case 'groupTabs':
      await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(handleMissingReceiverError);
      break;

    case 'suspendTabs':
      await Commands.suspendTabs(selectedTabIds);
      break;
    case 'resumeTabs':
      await Commands.resumeTabs(selectedTabIds);
      break;

    case 'selectAll':
      selection.setAll(true);
      shouldClearSelection = false;
      break;
    case 'select':
      selection.set(tab, true);
      shouldClearSelection = false;
      break;
    case 'unselect':
      selection.set(tab, false);
      shouldClearSelection = false;
      break;
    case 'invertSelection':
      selection.invert();
      shouldClearSelection = false;
      break;

    default:
      if (itemId.indexOf('clipboard:') == 0) {
        const id = itemId.replace(/^clipboard:/, '');
        let format;
        if (Array.isArray(configs.copyToClipboardFormats)) {
          let index = id.match(/^([0-9]+):/);
          index = parseInt(index[1]);
          const item = configs.copyToClipboardFormats[index];
          format = item.format;
        }
        else {
          format = configs.copyToClipboardFormats[id.replace(/^[0-9]+:/, '')];
        }
        if (shouldClearSelection) {
          await selection.clear();
          await wait(100); // to wait tab titles are updated
        }
        await Commands.copyToClipboard(selectedTabIds, format);
      }
      else if (itemId.indexOf('moveToOtherWindow:') == 0) {
        const id = parseInt(itemId.replace(/^moveToOtherWindow:/, ''));
        await Commands.moveToWindow(selectedTabIds, id);
      }
      else if (itemId.indexOf('extra:') == 0) {
        const idMatch   = itemId.match(/^extra:([^:]+):(.+)$/);
        const owner     = idMatch[1];
        const id        = idMatch[2];
        const apiTabSelection = await selection.getAPITabSelection({
          selectedIds: selectedTabIds
        });
        browser.runtime.sendMessage(owner, {
          type: Constants.kMTHAPI_INVOKE_SELECTED_TAB_COMMAND,
          id,
          selection: apiTabSelection
        }).catch(_e => {});
      }
      break;
  }

  if (shouldClearSelection)
    selection.clear();
};
browser.menus.onClicked.addListener(onClick);

function onMessage(message) {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO:
      return Promise.resolve(mActiveItems);

    case Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK:
      return onClick({ menuItemId: message.id });
  }
}

function onMessageExternal(message, sender) {
  if (configs.debug)
    console.log('onMessageExternal: ', message, sender);

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }

  switch (message.type) {
    case Constants.kMTHAPI_ADD_SELECTED_TAB_COMMAND: {
      const addons = Object.assign({}, configs.cachedExternalAddons);
      addons[sender.id] = true;
      configs.cachedExternalAddons = addons;
      mExtraItems[`${sender.id}:${message.id}`] = message;
      return reserveRefreshItems(null, true).then(() => true);
    };

    case Constants.kMTHAPI_REMOVE_SELECTED_TAB_COMMAND:
      delete mExtraItems[`${sender.id}:${message.id}`];
      return reserveRefreshItems(null, true).then(() => true);
  }
}

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return onClick(message.info, message.tab);
  }
}


// hide submenu for self panel

let mIsPanelOpen = false;
const mPanelConnectionMatcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
browser.runtime.onConnect.addListener(port => {
  if (!mPanelConnectionMatcher.test(port.name))
    return;
  mIsPanelOpen = true;
  port.onDisconnect.addListener(_message => {
    mIsPanelOpen = false;
  });
});

if (mUseNativeContextMenu) {
  browser.menus.onShown.addListener((info, _tab) => {
    const visible = !mIsPanelOpen || info.viewType != 'popup';
    if (mLastSubmenuVisible == visible)
      return;
    browser.menus.update('selection', { visible })
      .then(() => {
        mLastSubmenuVisible = visible;
        browser.menus.refresh();
      })
      .catch(_e => {});
  });
}


DragSelection.onDragSelectionEnd.addListener(async (message, selectionInfo) => {
  await refreshItems(selectionInfo.dragStartTab, true);
  try {
    if (configs.autoOpenMenuOnDragEnd)
      await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_OPEN,
        window: (await browser.windows.getLastFocused()).id,
        tab:  selectionInfo.dragStartTab.id,
        left: message.clientX,
        top:  message.clientY
      }).catch(handleMissingReceiverError);
  }
  catch(e) {
    log('failed to open context menu: ', e);
  }
});

Selections.onCreated.addListener(selection => {
  selection.onChange.addListener((tabs, selected, options = {}) => {
    if (!options.dontUpdateMenu)
      reserveRefreshItems();
  });
});

configs.$addObserver(key => {
  switch (key) {
    case 'copyToClipboardFormats':
      reserveRefreshItems(null, true);
      break;

    default:
      if (key.indexOf('context_') == 0)
        reserveRefreshItems(null, true);
      break;
  }
});
