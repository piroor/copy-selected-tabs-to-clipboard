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
import * as ContextMenu from './context-menu.js';
import RichConfirm from '/extlib/RichConfirm.js';

log.context = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  registerToTST();
  window.addEventListener('pagehide', async () => {
    unregisterFromTST();
  }, { once: true });
}, { once: true });


/*  listen events */

async function onShortcutCommand(command) {
  const activeTab = (await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0];
  const tabs = await Commands.getMultiselectedTabs(activeTab);

  if (tabs.length <= 0)
    return;

  switch (command) {
    case 'copySelectedTabs': {
      let formats;
      if (!Array.isArray(configs.copyToClipboardFormats)) { // migrate to array
        formats = [];
        for (const label of Object.keys(configs.copyToClipboardFormats)) {
          formats.push({
            label:  label,
            format: configs.copyToClipboardFormats[label]
          });
        }
      }
      else {
        formats = configs.copyToClipboardFormats;
      }
      const result = await RichConfirm.showInTab(activeTab.id, {
        message: browser.i18n.getMessage('command_copySelectedTabs_message'),
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
  }
}

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_NOTIFY_READY:
      registerToTST();
      ContextMenu.init();
      return Promise.resolve(true);
  }
}

function onMessageExternal(message, sender) {
  log('onMessageExternal: ', message, sender);

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
