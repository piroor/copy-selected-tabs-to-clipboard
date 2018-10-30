/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  handleMissingReceiverError
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Commands from '/common/commands.js';

function createItem(item) {
  browser.menus.create(item);
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_CONTEXT_MENU_CREATE,
      params: item
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
}

const mMenuItem = {
  id:       'clipboard',
  type:     'normal',
  visible:  true,
  title:    browser.i18n.getMessage('context_clipboard_label'),
  icons:    browser.runtime.getManifest().icons,
  contexts: ['tab', 'page']
};
const mFormatItems = new Map();

export function init() {
  createItem(mMenuItem);
  configs.$loaded.then(refreshFormatItems);
}

configs.$addObserver(key => {
  switch (key) {
    case 'copyToClipboardFormats':
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
    removeItem(id);
  }
  mFormatItems.clear();

  const formats = configs.copyToClipboardFormats;
  for (let i = 0, maxi = formats.length; i < maxi; i++) {
    const format = formats[i];
    const id     = `clipboard:${i}:${format.label}`;
    const item   = {
      id,
      parentId: 'clipboard',
      title:    format.label,
      visible:  true
    };
    mFormatItems.set(id, item);
    await createItem(item);
  }
}

async function onShown(info, tab) {
  const tabs = await Commands.getMultiselectedTabs(tab);
  const lastVisible = mMenuItem.visible;
  mMenuItem.visible = mFormatItems.size > 0 && (tabs.length > 1 || configs.showContextCommandForSingleTab);
  if (lastVisible == mMenuItem.visible)
    return;

  browser.menus.update(mMenuItem.id, { visible: mMenuItem.visible });
  browser.menus.refresh();
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
      params: [mMenuItem.id, { visible: mMenuItem.visible }]
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}
browser.menus.onShown.addListener(onShown);

async function onClick(info, tab) {
  log('context menu item clicked: ', info, tab);
  const tabs = await Commands.getMultiselectedTabs(tab);
  log('tabs: ', tabs);

  if (info.menuItemId.indexOf('clipboard:') != 0)
    return;

  const id = info.menuItemId.replace(/^clipboard:/, '');
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

  await Commands.copyToClipboard(tabs, format);

  if (configs.clearSelectionAfterCommandInvoked &&
      tabs.length > 1) {
    const activeTab = tabs.filter(tab => tab.active)[0];
    browser.tabs.highlight({
      windowId: activeTab.windowId,
      tabs:     [activeTab.index]
    });
  }
};
browser.menus.onClicked.addListener(onClick);

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
}
browser.runtime.onMessageExternal.addListener(onMessageExternal);

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return onClick(message.info, message.tab);

    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      return onShown(message.info, message.tab);
  }
}

init();
