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
  optionsExpandedSections: ['section-general'],

  context_reloadTabs: true,
  context_bookmarkTabs: true,
  context_removeBookmarkFromTabs: false,
  context_duplicateTabs: true,
  context_pinTabs: true,
  context_unpinTabs: true,
  context_muteTabs: true,
  context_unmuteTabs: true,
  context_moveToNewWindow: true,
  context_moveToOtherWindow: true,
  context_removeTabs: true,
  context_removeOther: true,
  context_clipboard: true,
  context_saveTabs: true,
  context_printTabs: false,
  context_freezeTabs: false,
  context_unfreezeTabs: false,
  context_protectTabs: false,
  context_unprotectTabs: false,
  context_lockTabs: false,
  context_unlockTabs: false,
  context_groupTabs: false,
  context_suspendTabs: true,
  context_resumeTabs: true,
  context_selectAll: true,
  context_select: true,
  context_unselect: true,
  context_invertSelection: true,

  clearSelectionAfterCommandInvoked: false,
  autoOpenMenuOnDragEnd: true,
  copyToClipboardFormats: defaultClipboardFormats,
  theme: 'default',
  useCRLF: false,
  useWorkaroundForBug1272869: true,

  panelMinWidth: '25em',
  panelMaxWidth: '30em',
  panelMinHeight: '20em',
  panelMaxHeight: '25em',
  panelFontSize: 'medium',

  saveTabsPrefix: browser.i18n.getMessage('saveTabsPrefix_defaultValue'),

  disablePanelWhenAlternativeTabBarIsAvailable: true,

  cachedExternalAddons: {},

  enableDragSelection: true,
  enableIntegrationWithTST: true,

  requestingPermissions: null,
  requestingPermissionsNatively: null,

  applyThemeColorToIcon: false,

  shouldNotifyUpdatedFromLegacyVersion: false,
  debug: false
}, {
  localKeys: `
    optionsExpandedSections
    theme
    useCRLF
    useWorkaroundForBug1272869
    cachedExternalAddons
    requestingPermissions
    requestingPermissionsNatively
    shouldNotifyUpdatedFromLegacyVersion
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
  console.log(`mth<${log.context}>: ${indent}${message}`, ...args);
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

export async function notify(params = {}) {
  const id = await browser.notifications.create({
    type:    'basic',
    iconUrl: params.icon,
    title:   params.title,
    message: params.message
  });

  let timeout = params.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  await browser.notifications.clear(id);
}

export function handleMissingReceiverError(error) {
  if (!error ||
      !error.message ||
      error.message.indexOf('Could not establish connection. Receiving end does not exist.') == -1)
    throw error;
  // otherwise, this error is caused from missing receiver.
  // we just ignore it.
}
