/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';

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
  format: '<a title="%TITLE_HTML%" href="%URL_HTML%">%TITLE_HTML%</a>'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_label'),
  format: '[%TITLE%](%URL% "%TITLE%")'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_list_label'),
  format: '%TST_INDENT(  )%* [%TITLE%](%URL% "%TITLE%")'
});

export const configs = new Configs({
  showContextCommandOnTab: true,
  showContextCommandOnPage: false,
  showContextCommandForSingleTab: true,
  clearSelectionAfterCommandInvoked: false,
  copyToClipboardFormats: defaultClipboardFormats,
  useCRLF: false,
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
