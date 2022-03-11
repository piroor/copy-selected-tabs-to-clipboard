/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  handleMissingReceiverError,
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Commands from '/common/commands.js';

const mMenuItems = [
  {
    id:       'clipboardOnTab',
    type:     'normal',
    visible:  true,
    title:    browser.i18n.getMessage('context_copyTabs_label'),
    icons:    browser.runtime.getManifest().icons,
    contexts: ['tab'],
    config:   'showContextCommandOnTab'
  },
  {
    id:       'clipboardOnPage',
    type:     'normal',
    visible:  true,
    title:    browser.i18n.getMessage('context_copyTabs_label'),
    icons:    browser.runtime.getManifest().icons,
    contexts: ['page'],
    config:   'showContextCommandOnPage'
  }
];
const mFormatItems = new Map();

function createItem(item) {
  const params = {
    id:       item.id,
    type:     item.type || 'normal',
    visible:  item.visible,
    title:    item.title
  };
  if (item.icons)
    params.icons = item.icons;
  if (item.contexts)
    params.contexts = item.contexts;
  if (item.parentId)
    params.parentId = item.parentId;
  browser.menus.create(params);
  if (item.contexts && !item.contexts.includes('tab'))
    return;
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_CONTEXT_MENU_CREATE,
      params: params
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
  try {
    if (!/^clipboardOn(Tab|Page)$/.test(item.id))
      browser.runtime.sendMessage(Constants.kMTH_ID, {
        ...params,
        type:  Constants.kMTHAPI_ADD_SELECTED_TAB_COMMAND,
        title: `${mMenuItems[0].title}:${item.title}`
      }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}

function removeItem(id) {
  browser.menus.remove(id);
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_CONTEXT_MENU_REMOVE,
      params: id
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
  try {
    browser.runtime.sendMessage(Constants.kMTH_ID, {
      type: Constants.kMTHAPI_REMOVE_SELECTED_TAB_COMMAND,
      id
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}

export function init() {
  for (const item of mMenuItems) {
    createItem(item);
  }
  configs.$loaded.then(refreshFormatItems);
}

configs.$addObserver(key => {
  switch (key) {
    case 'copyToClipboardFormats':
    case 'showContextCommandOnTab':
    case 'showContextCommandOnPage':
      reserveRefreshFormatItems();
      break;
  }
});

function reserveRefreshFormatItems() {
  if (reserveRefreshFormatItems.timeout)
    clearTimeout(reserveRefreshFormatItems.timeout);
  reserveRefreshFormatItems.timeout = setTimeout(() => {
    refreshFormatItems();
  }, 150);
}
async function refreshFormatItems() {
  for (const id of mFormatItems.keys()) {
    removeItem(`${id}:clipboardOnPageTopLevel`);
    removeItem(`${id}:clipboardOnTabTopLevel`);
    removeItem(`${id}:under_clipboardOnTab`);
    removeItem(`${id}:under_clipboardOnPage`);
  }
  mFormatItems.clear();

  const formats = configs.copyToClipboardFormats;
  const topLevelShown = (formats.length - formats.filter(format => format.enabled === false).length) == 1;
  for (let i = 0, maxi = formats.length; i < maxi; i++) {
    const format = formats[i];
    const id     = `clipboard:${i}:${format.label}`;
    const item   = {
      id,
      title:   format.label,
      visible: format.enabled !== false
    };
    mFormatItems.set(id, item);
    await Promise.all([
      createItem({
        ...item,
        id:       `${id}:clipboardOnTabTopLevel`,
        icons:    browser.runtime.getManifest().icons,
        contexts: ['tab'],
        visible:  topLevelShown && item.visible && configs.showContextCommandOnTab
      }),
      createItem({
        ...item,
        id:       `${id}:under_clipboardOnTab`,
        parentId: 'clipboardOnTab'
      }),
      createItem({
        ...item,
        id:       `${id}:clipboardOnPageTopLevel`,
        icons:    browser.runtime.getManifest().icons,
        contexts: ['page'],
        visible:  topLevelShown && item.visible && configs.showContextCommandOnPage
      }),
      createItem({
        ...item,
        id:       `${id}:under_clipboardOnPage`,
        parentId: 'clipboardOnPage'
      })
    ]);
  }
  for (const item of mMenuItems) {
    item.hiddenForTopLevelItem = topLevelShown;
  }
}

async function onShown(info, tab) {
  const { isAll, isTree, onlyDescendants, hasMultipleTabs } = await Commands.getContextState({ baseTab: tab });
  const titleKey = onlyDescendants ? 'context_copyTreeDescendants_label' :
    isTree ? 'context_copyTree_label' :
      isAll ? 'context_copyAllTabs_label' :
        hasMultipleTabs ? 'context_copyTabs_label' :
          'context_copyTab_label';
  let updated = false;
  let useTopLevelItem = false;
  for (const item of mMenuItems) {
    if (item.hiddenForTopLevelItem)
      useTopLevelItem = true;
    const lastVisible = item.visible;
    const lastTitle   = item.title;
    item.visible = (
      !item.hiddenForTopLevelItem &&
      configs[item.config] &&
      mFormatItems.size > 0 &&
      (hasMultipleTabs || (configs.fallbackForSingleTab != Constants.kCOPY_NOTHING))
    );
    item.title = browser.i18n.getMessage(titleKey);
    if (lastVisible == item.visible &&
        lastTitle == item.title)
      continue;

    const params = {
      visible: item.visible,
      title:   item.title
    };
    browser.menus.update(item.id, params);
    updated = true;
    if (!item.contexts.includes('tab'))
      continue;
    try {
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
        params: [item.id, params]
      }).catch(handleMissingReceiverError);
    }
    catch(_e) {
    }
  }
  if (useTopLevelItem) {
    const prefix = browser.i18n.getMessage(titleKey);
    for (const id of mFormatItems.keys()) {
      const params = {
        title: `${prefix}: ${mFormatItems.get(id).title}`
      };
      for (const idWithSuffix of [`${id}:clipboardOnTabTopLevel`, `${id}:clipboardOnPageTopLevel`]) {
        browser.menus.update(idWithSuffix, params);
        try {
          browser.runtime.sendMessage(Constants.kTST_ID, {
            type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
            params: [idWithSuffix, params]
          }).catch(handleMissingReceiverError);
        }
        catch(_e) {
        }
      }
      updated = true;
    }
  }
  if (updated)
    browser.menus.refresh();
}
browser.menus.onShown.addListener(onShown);

async function onClick(info, tab, selectedTabs = null) {
  log('context menu item clicked: ', info, tab);

  if (info.menuItemId.indexOf('clipboard:') != 0)
    return;

  const id = info.menuItemId.replace(/^clipboard:|:under_clipboardOn(Tab|Page)$/g, '');
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

  const isModifiedAction = info.button == 1;
  const fallbackOption = isModifiedAction ? configs.fallbackForSingleTabModified : configs.fallbackForSingleTab;
  const withContainer = Constants.WITH_CONTAINER_MATCHER.test(format);
  const { tabs } = await Commands.getContextState({ baseTab: tab, selectedTabs, callbackOption: fallbackOption, withContainer });
  log('withContainer: ', withContainer);
  log('tabs: ', tabs);

  await Commands.copyToClipboard(tabs, format);

  if (configs.clearSelectionAfterCommandInvoked &&
      tabs.length > 1) {
    const activeTab = tabs.filter(tab => tab.active)[0] || (await browser.tabs.query({ windowId: tab.windowId, active: true }))[0];
    browser.tabs.highlight({
      windowId: activeTab.windowId,
      tabs:     [activeTab.index]
    });
  }
};
browser.menus.onClicked.addListener(onClick);

function onMessageExternal(message, sender) {
  log('onMessageExternal: ', message, sender);

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    case Constants.kMTH_ID: { // Multiple Tab Handler API
      const result = onMTHAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }
}
browser.runtime.onMessageExternal.addListener(onMessageExternal);

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      if (!message.tab)
        return;
      return browser.tabs.get(message.tab.id).then(tab => onClick(message.info, tab));

    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      if (!message.tab)
        return;
      return browser.tabs.get(message.tab.id).then(tab => onClick(message.info, tab));
  }
}

function onMTHAPIMessage(message) {
  switch (message.type) {
    case Constants.kMTHAPI_INVOKE_SELECTED_TAB_COMMAND:
      return Commands.getMultiselectedTabs({ windowId: message.windowId, highlighted: true }).then(tabs => onClick({ menuItemId: message.id }, null, tabs));
  }
}

init();
