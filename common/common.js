/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';
import * as Constants from './constants.js';

const defaultClipboardFormats = [];
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_url_label'),
  format: '%URL%'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_title_and_url_label'),
  format: '%TITLE%%EOL%%URL%'
});
/*
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_title_and_url_tree_label'),
  format: '%TST_INDENT(|   )(|---)%%TITLE%%EOL%%TST_INDENT(|   )%%URL%'
});
*/
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_html_link_label'),
  format: '<a title="%HTML_SAFE(%TITLE%)%" href="%HTML_SAFE(%URL%)%">%HTML_SAFE(%TITLE%)%</a>'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_label'),
  format: '[%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_list_label'),
  format: '%TST_INDENT("  ")%* [%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")'
});

export const configs = new Configs({
  showContextCommandOnTab: true,
  showContextCommandOnPage: false,
  chooseContextCommandActions: true,
  fallbackForSingleTab:         Constants.kCOPY_SINGLE_TAB,
  fallbackForSingleTabModified: Constants.kCOPY_TREE,
  showContextCommandForSingleTab: null, // obsolete: migrated to fallbackForSingleTab=kCOPY_SINGLE_TAB
  clearSelectionAfterCommandInvoked: false,
  shouldNotifyResult: true,
  copyToClipboardFormats: defaultClipboardFormats,
  reportErrors: false,
  useCRLF: false,
  notificationTimeout: 10 * 1000,
  debug: false
}, {
  localKeys: `
    useCRLF
    debug
  `.trim().split('\n').map(key => key.trim()).filter(key => key && key.indexOf('//') != 0)
});


export function log(message, ...args)
{
  if (!configs || !configs.debug)
    return;

  const nest = (new Error()).stack.split('\n').length;
  let indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  console.log(`clipboard<${log.context}>: ${indent}${message}`, ...args);
}
log.context = '?';

export async function wait(task = 0, timeout = 0) {
  if (typeof task != 'function') {
    timeout = task;
    task = null;
  }
  return new Promise((resolve, _reject) => {
    setTimeout(async () => {
      if (task)
        await task();
      resolve();
    }, timeout);
  });
}

export function handleMissingReceiverError(error) {
  if (!error ||
      !error.message ||
      error.message.indexOf('Could not establish connection. Receiving end does not exist.') == -1)
    throw error;
  // otherwise, this error is caused from missing receiver.
  // we just ignore it.
}

export async function notify({ icon, title, message, timeout, url } = {}) {
  const id = await browser.notifications.create({
    type:    'basic',
    iconUrl: icon || '/resources/Copy.svg',
    title,
    message
  });

  let onClicked;
  let onClosed;
  return new Promise(async (resolve, _reject) => {
    let resolved = false;

    onClicked = notificationId => {
      if (notificationId != id)
        return;
      if (url) {
        browser.tabs.create({
          url
        });
      }
      resolved = true;
      resolve(true);
    };
    browser.notifications.onClicked.addListener(onClicked);

    onClosed = notificationId => {
      if (notificationId != id)
        return;
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    };
    browser.notifications.onClosed.addListener(onClosed);

    if (typeof timeout != 'number')
      timeout = configs.notificationTimeout;
    if (timeout >= 0) {
      await wait(timeout);
    }
    await browser.notifications.clear(id);
    if (!resolved)
      resolve(false);
  }).then(clicked => {
    browser.notifications.onClicked.removeListener(onClicked);
    onClicked = null;
    browser.notifications.onClosed.removeListener(onClosed);
    onClosed = null;
    return clicked;
  });
}


export async function collectTabsFromTree(treeItem, { onlyDescendants } = {}) {
  const treeItemIds = new Set(collectTreeItemIds(treeItem));
  if (onlyDescendants)
    treeItemIds.delete(treeItem.id);
  const allTabs     = await browser.tabs.query({ windowId: treeItem.windowId });
  return allTabs.filter(tab => treeItemIds.has(tab.id));
}

function collectTreeItemIds(treeItem) {
  return [treeItem.id, ...treeItem.children.map(collectTreeItemIds)].flat();
}
