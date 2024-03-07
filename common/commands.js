/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as PlaceHolderParser from '/extlib/placeholder-parser.js';
import * as Replacer from '/extlib/replacer.js';

import {
  log,
  configs,
  notify,
  collectAncestors,
} from './common.js';
import * as Constants from './constants.js';
import * as Permissions from './permissions.js';

const kFORMAT_PARAMETER_MATCHER  = /\([^\)]+\)|\[[^\]]+\]|\{[^\}]+\}|<[^>]+>/;
const kFORMAT_MATCHER_TREE_INDENT = new RegExp(`%(TST|TREE)_INDENT(?:${kFORMAT_PARAMETER_MATCHER.source})*%`, 'i');

function getDelimiter() {
  switch (configs.delimiter) {
    case Constants.kDELIMITER_SPACE:
      return ' ';

    case Constants.kDELIMITER_TAB:
      return '\t';

    default:
      return getLineFeed();
  }
}

function getLineFeed() {
  return configs.useCRLF ? '\r\n' : '\n';
}

export async function copyToClipboard(tabs, format) {
  let indentLevels = [];
  if (kFORMAT_MATCHER_TREE_INDENT.test(format)) {
    try {
      const ancestorsOf = collectAncestors(tabs);
      // ignore indent information for partial selection
      const ids = tabs.map(tab => tab.id);
      indentLevels = tabs.map(tab => {
        return ancestorsOf[tab.id].filter(ancestorId => ids.indexOf(ancestorId) > -1).length
      });
    }
    catch(error) {
      console.log('failed to collect tree ancestors of tabs: ', error);
    }
  }

  const delimiter = getDelimiter();
  const itemsToCopy = await Promise.all(tabs.map((tab, index) => fillPlaceHolders(format, tab, indentLevels[index])));

  const richText = /%RT%/i.test(format) ? itemsToCopy.map(item => item.richText).join('<br />') : null ;
  let plainText = itemsToCopy.map(item => item.plainText).join(delimiter);
  if (configs.delimiter == Constants.kDELIMITER_LINE_BREAK &&
      tabs.length > 1)
    plainText += delimiter;

  log('richText: ', richText);
  log('plainText: ', plainText);

  if (!richText) {
    log('trying to write text to clipboard via Clipboard API');
    try {
      navigator.clipboard.writeText(plainText)
        .then(() => {
          notifyCopied(tabs.length, plainText);
        })
        .catch(error => {
          notifyFailed(error);
        });
      return;
    }
    catch(error) {
      notifyFailed(error);
    }
    return;
  }

  if (typeof navigator.clipboard.write == 'function') {
    log('trying to write data to clipboard via Clipboard API');
    try {
     /* const dt = new DataTransfer();
      		dt.items.add(plainText, 'text/plain');
     		dt.items.add(richText, 'text/html'); */

			const ci1 = new ClipboardItem({
				["text/plain"]: plainText,
				["text/html"]: richText,
			});

			/* navigator.clipboard
				.write([ci1])
				.then(() => {
					notifyCopied(tabs.length, plainText);
				})
				.catch((error) => {
					notifyFailed(error);
				}); */

			await navigator.clipboard.write([ci1]).then(() => {
				notifyCopied(tabs.length, plainText);
			});

			console.log("Text has been copied to clipboard");
      
      return;
    }
    catch(error) {
      notifyFailed(error);
    }
    return;
  }

  const doCopy = function() {
    let done = false;
    return new Promise((resolve, _reject) => {
      // This block won't work if dom.event.clipboardevents.enabled=false.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1396275
      document.addEventListener('copy', event => {
        if (done)
          return;
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData.setData('text/plain', plainText);
        event.clipboardData.setData('text/html',  richText);
        done = true;
        resolve(true);
      }, {
        once:    true,
        capture: true
      });
      document.execCommand('copy');
      setTimeout(() => {
        if (done)
          return;
        done = true;
        resolve(false);
      }, 250);
    });
  };

  log('trying to write data to clipboard via execCommand with a content page');
  /* Due to Firefox's limitation, we cannot copy text from background script.
     Moreover, when this command is called from context menu on a tab,
     there is no browser_action page.
     Thus we need to use a temporary blank tab or window and execute
     the copy command inside its content area.
     See also:
      https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard#Browser-specific_considerations
      https://bugzilla.mozilla.org/show_bug.cgi?id=1272869
      https://bugzilla.mozilla.org/show_bug.cgi?id=1344410
  */
  let temporaryTab;
  let temporaryWindow;
  try {
    temporaryTab = await browser.tabs.create({
      windowId: tabs[0].windowId,
      url:      'about:blank',
      active:   false,
      // hidden:   true, // not supported...
      index:    (tabs.find(tab => tab.active) || tabs[0]).index + 1, // open next to the visible tab to prevent scrolling of the tab bar
    });
  }
  catch(error) {
    try {
      log(`cannot open temporary tab in the window ${tabs[0].windowId}, retrying with a temporary window. `, error);
      temporaryWindow = await browser.windows.create({
        url:    'about:blank',
        width:  100,
        height: 100,
        left:   0,
        top:    0
      });
      const [activeTab] = await browser.tabs.query({
        active: true,
        windowId: temporaryWindow.id,
      });
      temporaryTab = activeTab;
    }
    catch(error) {
      log(`cannot open temporary window, fallback to an alert dialog. `, error);
    }
  }
  if (temporaryTab) {
    const code = `
      (() => {
        let richText = ${JSON.stringify(richText)};
        let plainText = ${JSON.stringify(plainText)};
        return (${doCopy.toString()})();
      })();
    `;
    const results = await browser.tabs.executeScript(temporaryTab.id, {
      matchAboutBlank: true,
      code
    }).catch(error => {
      log(`failed to execute code in the tab ${temporaryTab.id}`, error);
      return [];
    });
    if (temporaryWindow)
      await browser.windows.remove(temporaryWindow.id);
    else
      await browser.tabs.remove(temporaryTab.id);
    if (results[0]) {
      notifyCopied(tabs.length, plainText);
      return;
    }
  }

  log('failed to write rich text data to the clipboard, so fallback to plain text data copy via Clipboard API');
  try {
    navigator.clipboard.writeText(plainText)
      .then(() => {
        notifyCopied(tabs.length, plainText);
      })
      .catch(error => {
        notifyFailed(error);
      });
    return;
  }
  catch(error) {
    notifyFailed(error);
  }
}

export async function fillPlaceHolders(format, tab, indentLevel) {
  log(`fillPlaceHolders for tab #{tab.id}`, { format, indentLevel });
  const now = new Date();
  let params = {
    tab,
    indentLevel,
    delimiter: getDelimiter(),
    timeUTC:   now.toUTCString(),
    timeLocal: now.toLocaleString()
  };
  if (tab.discarded) {
    if (configs.reportErrors) {
      params.author      = browser.i18n.getMessage('error_discarded_author');
      params.description = browser.i18n.getMessage('error_discarded_description');
      params.keywords    = browser.i18n.getMessage('error_discarded_keywords');
    }
  }
  else if (!Permissions.isPermittedTab(tab)) {
    if (configs.reportErrors) {
      params.author      = browser.i18n.getMessage('error_unpermitted_author');
      params.description = browser.i18n.getMessage('error_unpermitted_description');
      params.keywords    = browser.i18n.getMessage('error_unpermitted_keywords');
    }
  }
  else if (/%(AUTHOR|DESC(?:RIPTION)?|KEYWORDS)(?:_HTML(?:IFIED)?)?%/i.test(format)) {
    log('trying to get data from content ', tab.id);
    try {
      let paramsFromContent = await browser.tabs.executeScript(tab.id, {
        file: '/common/get-content-text.js'
      });
      if (Array.isArray(paramsFromContent))
        paramsFromContent = paramsFromContent[0];
      params = { ...params, ...paramsFromContent };
    }
    catch(error) {
      console.log(`failed to get data from content `, tab.id, tab.url, error);
      if (configs.reportErrors) {
        const errorMessage = error instanceof Error ? `${String(error)}\n${error.stack}` : String(error);
        params.author      = browser.i18n.getMessage('error_failed_author', [errorMessage]);
        params.description = browser.i18n.getMessage('error_failed_description', [errorMessage]);
        params.keywords    = browser.i18n.getMessage('error_failed_keywords', [errorMessage]);
      }
    }
    log('params ', params);
  }

  try {
    const filled = fillPlaceHoldersInternal(format, params);

    if (/%RT%/i.test(format)) {
      return {
        richText:  filled.trim() && filled ||
                     `<a href="${sanitizeHtmlText(tab.url)}">${sanitizeHtmlText(tab.title)}</a>`,
        plainText: filled.trim() && filled ||
                     `${tab.title}<${tab.url}>`
      };
    }
    return {
      richText:  '',
      plainText: filled
    };
  }
  catch(error) {
    if (error instanceof Replacer.ReplacerError || error instanceof PlaceHolderParser.PlaceHolderParserError)
      return {
        richText:  '',
        plainText: error.message
      };

    console.error(error);
    return {
      richText:  '',
      plainText: error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
    };
  }
}

function fillPlaceHoldersInternal(
  format,
  { tab, author, description, keywords, timeUTC, timeLocal, delimiter, indentLevel } = {}
) {
  return PlaceHolderParser.process(format, (name, rawArgs, ...args) => {
    return processPlaceHolder(
      name,
      rawArgs,
      args,
      { tab, author, description, keywords, timeUTC, timeLocal, delimiter, indentLevel }
    );
  }, '', log);
}

const HTML_SAFE_PATTERN = /^(.+)_HTML(?:IFIED)?$/i;

function processPlaceHolder(
  name,
  rawArgs,
  args,
  { tab, author, description, keywords, timeUTC, timeLocal, delimiter, indentLevel } = {}
) {
  log('processPlaceHolder ', name, rawArgs, args);
  switch (name.trim().toLowerCase()) {
    case 'rt':
      return '';

    case 'html':
    case 'html_safe':
      return sanitizeHtmlText(args[0]);

    case 'md':
    case 'md_safe':
      return sanitizeMdText(args[0]);

    case 'md_link_title':
    case 'md_link_title_safe':
      return sanitizeMdLinkTitleText(args[0]);

    case 'replace':
      return Replacer.replace(args, log);

    case 'any':
      for (const arg of args) {
        if (!!arg)
          return arg;
      }
      return '';

    case 'rlink':
    case 'sel':
      return '';

    case 'url':
      return tab.url;

    case 'title':
    case 'text':
      return tab.title;

    case 'container_name':
    case 'container_title': {
      const [prefix, suffix] = args.length == 0 ? ['', ''] : args;
      return tab.container ? `${prefix}${tab.container}${suffix}` : '';
    }

    case 'container_url':
      return tab.container ? `ext+container:name=${tab.container}&url=${tab.url}` : tab.url;

    case 'author':
      return author || '';

    case 'desc':
    case 'description':
      return description || '';

    case 'keywords':
      return keywords || '';

    case 'utc_time':
      return timeUTC;

    case 'local_time':
      return timeLocal;

    case 'tab':
      return '\t';

    case 'eol':
      return getLineFeed();

    case 'tst_indent': {
      const indenters = args.length == 0 ?
        (rawArgs != '' ?  // for backward compatibility
          [rawArgs] : ['  ']) :
        args;
      let indent = '';
      for (let i = 0; i < indentLevel; i++) {
        const indenter = indenters[Math.min(i, indenters.length - 1)];
        indent = `${indenter}${indent}`;
      }
      return indent;
    }

    default: {
      // for backward compatibility
      const matchedToHTMLSafe = name.match(HTML_SAFE_PATTERN);
      if (matchedToHTMLSafe)
        return sanitizeHtmlText(processPlaceHolder(
          matchedToHTMLSafe[1],
          rawArgs,
          args,
          { tab, author, description, keywords, timeUTC, timeLocal, delimiter, indentLevel }
        ));

      return rawArgs ? `%${name}(${rawArgs})%` : `%${name}%`;
    }
  }

  throw new Error(`Unknown placeholder: ${name}`);
}

export function sanitizeHtmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// https://github.com/piroor/copy-selected-tabs-to-clipboard/pull/36
export function sanitizeMdText(text) {
  return text.replace(/[-!"#$%&'()*+,./:;<=>?@^_`{|}~\[\\\]]/g, '\\$&');
}

// https://github.com/piroor/copy-selected-tabs-to-clipboard/pull/36
export function sanitizeMdLinkTitleText(text) {
  return text.replace(/["'()&\\]/g, '\\$&');
}

async function notifyCopied(count, copied) {
  if (!configs.shouldNotifyResult)
    return;
  return notify({
    title:   browser.i18n.getMessage(count > 1 ? 'notification_copied_multiple_title' : 'notification_copied_title', [count]),
    message: browser.i18n.getMessage(count > 1 ? 'notification_copied_multiple_message' : 'notification_copied_message', [count, copied])
  });
}

async function notifyFailed(error) {
  log('failed to write text/data to clipboard: ', error);
  if (!configs.shouldNotifyResult)
    return;
  notify({
    title:   browser.i18n.getMessage('notification_failedToCopy_title'),
    message: browser.i18n.getMessage('notification_failedToCopy_message', [String(error)])
  });
}
