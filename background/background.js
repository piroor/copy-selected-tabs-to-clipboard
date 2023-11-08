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
import * as Commands from '/common/commands.js';
import * as Constants from '/common/constants.js';
import { Context } from '/common/Context.js';
import * as ContextMenu from './context-menu.js';
import RichConfirm from '/extlib/RichConfirm.js';

log.context = 'BG';

const ASSIGNABLE_SHORTCUT_COUNT = 20;

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  // migrate formats
  if (!Array.isArray(configs.copyToClipboardFormats)) {
    // from object to array
    const formats = [];
    for (const label of Object.keys(configs.copyToClipboardFormats)) {
      formats.push({
        label:   label,
        format:  configs.copyToClipboardFormats[label]
      });
    }
    configs.copyToClipboardFormats = formats;
  }
  if (configs.copyToClipboardFormats.some(format => !('id' in format) || !('enabled' in format))) {
    // fixup missing property
    const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
    for (const format of formats) {
      if (!('id' in format))
        format.id = `format-${Date.now()}-${Math.round(Math.random() * 65000)}`;
      if (!('enabled' in format))
        format.enabled = true;
    }
    configs.copyToClipboardFormats = formats;
  }

  if (configs.showContextCommandForSingleTab !== null) {
    configs.modeForNoSelection = configs.showContextCommandForSingleTab ? Constants.kCOPY_INDIVIDUAL_TAB : Constants.kCOPY_NOTHING;
    configs.showContextCommandForSingleTab = null;
  }
  if (configs.fallbackForSingleTab !== null) {
    configs.modeForNoSelection = configs.fallbackForSingleTab;
    configs.fallbackForSingleTab = null;
  }
  if (configs.fallbackForSingleTabModified !== null) {
    configs.modeForNoSelection = configs.fallbackForSingleTabModified;
    configs.fallbackForSingleTabModified = null;
  }

  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  registerToTST();
  window.addEventListener('pagehide', async () => {
    unregisterFromTST();
    unregisterFromMTH();
  }, { once: true });

  updateShortcutsForFormats();

  configs.$addObserver(key => {
    switch (key) {
      case 'copyToClipboardFormats':
        reserveToUpdateShortcutsForFormats();
        break;
    }
  });
}, { once: true });

function reserveToUpdateShortcutsForFormats() {
  if (reserveToUpdateShortcutsForFormats.reserved)
    clearTimeout(reserveToUpdateShortcutsForFormats.reserved);
  reserveToUpdateShortcutsForFormats.reserved = setTimeout(() => {
    reserveToUpdateShortcutsForFormats.reserved = null;
    updateShortcutsForFormats();
  }, 250);
}
reserveToUpdateShortcutsForFormats.reserved = null;

function updateShortcutsForFormats() {
  for (let i = 0; i < ASSIGNABLE_SHORTCUT_COUNT; i++) {
    if (i >= configs.copyToClipboardFormats.length) {
      browser.commands.update({
        name:        `copySelectedTabsWithFormat${i}`,
        description: browser.i18n.getMessage('command_copySelectedTabsWithFormat_unassigned')
      });
    }
    else {
      const format = configs.copyToClipboardFormats[i];
      const label = (format.label || format.format).replace(/\(&([^\s])\)/, '$1').replace(/&([^\s])/, '$1');
      browser.commands.update({
        name:        `copySelectedTabsWithFormat${i}`,
        description: browser.i18n.getMessage('command_copySelectedTabsWithFormat', [label])
      });
    }
  }
}


/*  listen events */

async function onShortcutCommand(command) {
  log('onShortcutCommand: ', command);
  const activeTab = (await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0];
  log('activeTab: ', activeTab);

  let format = null;
  let withContainer = false;
  if (/^copySelectedTabsWithFormat(\d+)$/.test(command)) {
    const index   = parseInt(RegExp.$1);
    const formats = configs.copyToClipboardFormats;
    format = formats.length >= index ? formats[index] : null;
    withContainer = Constants.WITH_CONTAINER_MATCHER.test(format.format);
  }
  else if (command == 'copySelectedTabs') {
    withContainer = configs.copyToClipboardFormats.some(format => Constants.WITH_CONTAINER_MATCHER.test(format.format));
  }

  const context = new Context({
    tab: activeTab,
    withContainer,
  });
  const tabs = await context.getTabsToCopy();
  log('withContainer: ', withContainer);
  log('tabs: ', tabs);

  if (tabs.length <= 0)
    return;


  switch (command) {
    case 'copySelectedTabs': {
      const titleKey = context.shouldCopyOnlyDescendants ? 'command_copyTreeDescendants_title' :
        context.isTreeParent ? 'command_copyTree_title' :
          'command_copySelectedTabs_title';
      const messageKey = context.shouldCopyOnlyDescendants ? 'command_copyTreeDescendants_message' :
        context.isTreeParent ? 'command_copyTree_message' :
          'command_copySelectedTabs_message';
      const formats = configs.copyToClipboardFormats;
      const result = await RichConfirm.showInPopup(activeTab.windowId, {
        modal:   true,
        url:     '/resources/blank.html', // required on Firefox ESR68
        title:   browser.i18n.getMessage(titleKey),
        message: browser.i18n.getMessage(messageKey),
        buttons: formats.map(format => format.label)
      });
      if (result.buttonIndex > -1) {
        await Commands.copyToClipboard(tabs, formats[result.buttonIndex].format);
        if (configs.clearSelectionAfterCommandInvoked) {
          browser.tabs.highlight({
            windowId: activeTab.windowId,
            tabs:     [activeTab.index]
          });
        }
      }
    } break;

    default:
      if (format) {
        await Commands.copyToClipboard(tabs, format.format);
        if (configs.clearSelectionAfterCommandInvoked) {
          browser.tabs.highlight({
            windowId: activeTab.windowId,
            tabs:     [activeTab.index]
          });
        }
      }
      break;
  }
}

function onMessageExternal(message, sender) {
  log('onMessageExternal: ', message, sender);

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      let result;
      switch (message.type) {
        case Constants.kTSTAPI_NOTIFY_READY:
          registerToTST();
          ContextMenu.init();
          result = true;
          break;
      }
      if (result !== undefined)
        return Promise.resolve(result);
    }; break;

    case Constants.kMTH_ID: { // Multiple Tab Handler API
      let result;
      switch (message.type) {
        case Constants.kMTHAPI_READY:
          ContextMenu.init();
          result = true;
          break;
      }
      if (result !== undefined)
        return Promise.resolve(result);
    }; break;

    default:
      break;
  }
}

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:  Constants.kTSTAPI_REGISTER_SELF,
      name:  browser.i18n.getMessage('extensionName'),
      icons: browser.runtime.getManifest().icons,
      listeningTypes: [
        Constants.kTSTAPI_NOTIFY_READY,
        Constants.kTSTAPI_CONTEXT_MENU_CLICK,
        Constants.kTSTAPI_CONTEXT_MENU_SHOWN
      ]
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
    return false;
  }
}

function unregisterFromTST() {
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    }).catch(handleMissingReceiverError);
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_UNREGISTER_SELF
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}

function unregisterFromMTH() {
  try {
    browser.runtime.sendMessage(Constants.kMTH_ID, {
      type: Constants.kMTHAPI_REMOVE_ALL_SELECTED_TAB_COMMANDS
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}
