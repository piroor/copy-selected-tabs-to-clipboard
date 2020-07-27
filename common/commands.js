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
} from './common.js';
import * as Constants from './constants.js';
import * as Permissions from './permissions.js';
import * as Replacer from './replacer.js';

export async function getMultiselectedTabs(tab) {
  if (!tab)
    return [];
  if (tab.highlighted)
    return browser.tabs.query({
      windowId:    tab.windowId,
      highlighted: true
    });
  else
    return [tab];
}

const kFORMAT_PARAMETER_MATCHER  = /\([^\)]+\)|\[[^\]]+\]|\{[^\}]+\}|<[^>]+>/g;
const kFORMAT_MATCHER_TST_INDENT = new RegExp(`%TST_INDENT(?:${kFORMAT_PARAMETER_MATCHER.source})*%`, 'gi');

export async function copyToClipboard(tabs, format) {
  const allTabs = await browser.tabs.query({ windowId: tabs[0].windowId });

  let indentLevels = [];
  if (kFORMAT_MATCHER_TST_INDENT.test(format)) {
    try {
      const tabsWithChildren = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: 'get-tree',
        tabs: tabs.map(tab => tab.id)
      }).catch(handleMissingReceiverError);
      const ancestorsOf = {};
      const collectAncestors = (tab) => {
        ancestorsOf[tab.id] = ancestorsOf[tab.id] || [];
        for (const child of tab.children) {
          collectAncestors(child);
          ancestorsOf[child.id] = [tab.id].concat(ancestorsOf[tab.id]);
        }
      };
      for (const tab of tabsWithChildren) {
        collectAncestors(tab);
      }
      // ignore indent information for partial selection
      const ids = tabs.map(tab => tab.id);
      indentLevels = tabsWithChildren.map(tab => {
        return ancestorsOf[tab.id].filter(ancestorId => ids.indexOf(ancestorId) > -1).length
      });
    }
    catch(_e) {
    }
  }

  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  const itemsToCopy = await Promise.all(tabs.map((tab, index) => fillPlaceHolders(format, tab, indentLevels[index])));

  const richText = /%RT%/i.test(format) ? itemsToCopy.map(item => item.richText).join('<br />') : null ;
  let plainText = itemsToCopy.map(item => item.plainText).join(lineFeed);
  if (tabs.length > 1)
    plainText += lineFeed;

  log('richText: ', richText);
  log('plainText: ', plainText);

  if (!richText) {
    log('trying to write text to clipboard via Clipboard API');
    try {
      return navigator.clipboard.writeText(plainText);
    }
    catch(e) {
      log('failed to write text to clipboard: ', e);
    }
    return;
  }

  if (typeof navigator.clipboard.write == 'function') {
    log('trying to write data to clipboard via Clipboard API');
    try {
      const dt = new DataTransfer();
      dt.items.add(plainText, 'text/plain');
      dt.items.add(richText, 'text/html');
      return navigator.clipboard.write(dt);
    }
    catch(e) {
      log('failed to write data to clipboard: ', e);
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

  log('trying to write data to clipboard via execCommand from content page');
  let permittedTabs = tabs.filter(Permissions.isPermittedTab);
  if (permittedTabs.length == 0) {
    permittedTabs = allTabs.filter(Permissions.isPermittedTab);
    if (permittedTabs.length == 0)
      throw new Error('no permitted tab to copy data to the clipboard');
  }
  const results = await browser.tabs.executeScript(permittedTabs[0].id, {
    /* Due to Firefox's limitation, we cannot copy text from background script.
       Moreover, when this command is called from context menu on a tab,
       there is no browser_action page.
       Thus we need to embed text field into webpage and execute a command to copy,
       but scripts in the webpage can steal the data - that's crazy and dangerous!
       See also:
        https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard#Browser-specific_considerations
        https://bugzilla.mozilla.org/show_bug.cgi?id=1272869
        https://bugzilla.mozilla.org/show_bug.cgi?id=1344410
    */
    code: `
      (() => {
        let richText = ${JSON.stringify(richText)};
        let plainText = ${JSON.stringify(plainText)};
        return (${doCopy.toString()})();
      })();
    `
  });
  if (results[0])
    return;

  log('failed to write rich text data to the clipboard, so fallback to plain text data copy via Clipboard API');
  try {
    return navigator.clipboard.writeText(plainText);
  }
  catch(e) {
    log('failed to write text to clipboard: ', e);
  }
}

export async function fillPlaceHolders(format, tab, indentLevel) {
  log('fillPlaceHolders ', tab.id, format, indentLevel);
  const now = new Date();
  let params = {
    tab,
    indentLevel,
    lineFeed:  configs.useCRLF ? '\r\n' : '\n',
    timeUTC:   now.toUTCString(),
    timeLocal: now.toLocaleString()
  };
  if (!tab.discarded &&
      Permissions.isPermittedTab(tab) &&
      /%(AUTHOR|DESC(?:RIPTION)?|KEYWORDS)(?:_HTML(?:IFIED)?)?%/i.test(format)) {
    log('trying to get data from content ', tab.id);
    let paramsFromContent = await browser.tabs.executeScript(tab.id, {
      file: '/common/get-content-text.js'
    });
    if (Array.isArray(paramsFromContent))
      paramsFromContent = paramsFromContent[0];
    params = { ...params, ...paramsFromContent };
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
    if (error instanceof Replacer.ReplacerError)
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
  { tab, author, description, keywords, timeUTC, timeLocal, lineFeed, indentLevel } = {}
) {
  return Replacer.processAll(format, (input, ..._replacePairs) => fillPlaceHoldersInternal(input, { tab, author, description, keywords, timeUTC, timeLocal, lineFeed, indentLevel }))
    .replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
    .replace(/%URL%/gi, tab.url)
    .replace(/%(?:TITLE|TEXT)%/gi, tab.title)
    .replace(/%URL_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.url))
    .replace(/%TITLE_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.title))
    .replace(/%AUTHOR%/gi, author || '')
    .replace(/%AUTHOR_HTML(?:IFIED)?%/gi, sanitizeHtmlText(author || ''))
    .replace(/%DESC(?:RIPTION)?%/gi, description || '')
    .replace(/%DESC(?:RIPTION)?_HTML(?:IFIED)?%/gi, sanitizeHtmlText(description || ''))
    .replace(/%KEYWORDS%/gi, keywords || '')
    .replace(/%KEYWORDS_HTML(?:IFIED)?%/gi, sanitizeHtmlText(keywords || ''))
    .replace(/%UTC_TIME%/gi, timeUTC)
    .replace(/%LOCAL_TIME%/gi, timeLocal)
    .replace(/%TAB%/gi, '\t')
    .replace(/%EOL%/gi, lineFeed)
    .replace(/%RT%/gi, '')
    .replace(kFORMAT_MATCHER_TST_INDENT, matched => {
      let indenters = matched.replace(/^%TST_INDENT|%$/g, '');
      if (indenters == '') {
        indenters = ['  '];
      }
      else {
        indenters = indenters
          .match(kFORMAT_PARAMETER_MATCHER)
          .map(indenter => indenter.substring(1, indenter.length - 1))
          .reverse();
      }
      let indent = '';
      for (let i = 0; i < indentLevel; i++) {
        const indenter = indenters[Math.min(i, indenters.length - 1)];
        indent = `${indenter}${indent}`;
      }
      return indent;
    });
}

export function sanitizeHtmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
