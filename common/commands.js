/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  notify,
  configs,
  handleMissingReceiverError
} from './common.js';
import * as Constants from './constants.js';
import * as Permissions from './permissions.js';
import TabIdFixer from '/extlib/TabIdFixer.js';

async function getTabsByIds(ids) {
  const tabs = await Promise.all(ids.map(id => browser.tabs.get(id).catch(_e => {})));
  return tabs.filter(tab => !!tab).sort((a, b) => a.index - b.index);
}

export async function reloadTabs(ids) {
  for (const id of ids) {
    browser.tabs.reload(id);
  }
}

export async function bookmarkTabs(ids, options = {}) {
  if (!(await Permissions.isGranted(Permissions.BOOKMARKS))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_bookmarks_title'),
      message: browser.i18n.getMessage('notPermitted_bookmarks_message')
    });
    return null;
  }

  const tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
  tabs.forEach(TabIdFixer.fixTab);
  const folderParams = {
    title: browser.i18n.getMessage('bookmarkFolder_label', tabs[0].title)
  };
  if (options.parentId) {
    folderParams.parentId = options.parentId;
    if ('index' in options)
      folderParams.index = options.index;
  }
  const folder = await browser.bookmarks.create(folderParams);
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    tab.title,
      url:      tab.url
    });
  }

  browser.bookmarks.get(folder.parentId).then(folders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTabs_notification_title'),
      message: browser.i18n.getMessage('bookmarkTabs_notification_message', [
        tabs[0].title,
        tabs.length,
        folders[0].title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  });
  return folder;
}

export async function duplicateTabs(ids) {
  for (const id of ids) {
    await browser.tabs.duplicate(id);
  }
}

export async function pinTabs(ids) {
  for (const id of ids) {
    await browser.tabs.update(id, { pinned: true });
  }
}

export async function unpinTabs(ids) {
  for (const id of ids) {
    await browser.tabs.update(id, { pinned: false });
  }
}

export async function muteTabs(ids) {
  for (const id of ids) {
    browser.tabs.update(id, { muted: true });
  }
}

export async function unmuteTabs(ids) {
  for (const id of ids) {
    browser.tabs.update(id, { muted: false });
  }
}

export async function moveToWindow(ids, windowId) {
  const structure = !configs.enableIntegrationWithTST ?
    null :
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_GET_TREE_STRUCTURE,
      tabs: ids
    }).catch(handleMissingReceiverError);
  log('structure ', structure);
  const firstTab = ids[0];
  let window;
  if (windowId) {
    window = await browser.windows.get(windowId);
  }
  else {
    window = await browser.windows.create({
      tabId: firstTab
    });
    ids = ids.slice(1);
  }
  if (configs.enableIntegrationWithTST)
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_BLOCK_GROUPING,
      window: window.id
    }).catch(handleMissingReceiverError);
  const waitUntilCompletelyMoved = new Promise((resolve, _reject) => {
    let restTabs = ids.length - 1;
    const listener = (_tabId, _attachInfo) => {
      restTabs--;
      if (restTabs <= 0) {
        browser.tabs.onAttached.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onAttached.addListener(listener);
  });
  await Promise.all([
    safeMoveApiTabsAcrossWindows(ids, {
      index:    1,
      windowId: window.id
    }),
    waitUntilCompletelyMoved
  ]);
  await browser.tabs.update(firstTab, { active: true });
  if (structure) {
    await wait(500); // wait until TST's initialization is finished
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_SET_TREE_STRUCTURE,
      tabs: ids,
      structure
    }).catch(handleMissingReceiverError);
  }
  if (configs.enableIntegrationWithTST)
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_UNBLOCK_GROUPING,
      window: window.id
    }).catch(handleMissingReceiverError);
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveApiTabsAcrossWindows(aTabIds, moveOptions) {
  return (await Promise.all(aTabIds.map(async (aTabId, index) => {
    try {
      let movedTab = await browser.tabs.move(aTabId, Object.assign({}, moveOptions, {
        index: moveOptions.index + index
      }));
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(_e) {
      return null;
    }
  }))).filter(tab => !!tab);
}

export async function removeTabs(removeIds) {
  const tabs = await getTabsByIds(removeIds);
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = tabs.reverse().map(tab => tab.id);
  await browser.tabs.remove(ids);
}

export async function removeOtherTabs(keepIds) {
  const keepTabs = await getTabsByIds(keepIds);
  const allTabs = await browser.tabs.query({ windowId: keepTabs[0].windowId });
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = allTabs.reverse().filter(tab => keepIds.indexOf(tab.id) < 0 && !tab.pinned).map(tab => tab.id);
  await browser.tabs.remove(ids);
}

const kFORMAT_PARAMETER_MATCHER  = /\([^\)]+\)|\[[^\]]+\]|\{[^\}]+\}|<[^>]+>/g;
const kFORMAT_MATCHER_TST_INDENT = new RegExp(`%TST_INDENT(?:${kFORMAT_PARAMETER_MATCHER.source})*%`, 'gi');

export async function copyToClipboard(ids, format) {
  if (!(await Permissions.isGranted(Permissions.CLIPBOARD_WRITE))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_clipboardWrite_title'),
      message: browser.i18n.getMessage('notPermitted_clipboardWrite_message')
    });
    return;
  }

  const tabs = await getTabsByIds(ids);
  const allTabs = await browser.tabs.query({ windowId: tabs[0].windowId });

  let indentLevels = [];
  if (kFORMAT_MATCHER_TST_INDENT.test(format) &&
      configs.enableIntegrationWithTST) {
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

  // available on Firefox 63 and later
  if (navigator.clipboard) {
    if (!richText &&
        typeof navigator.clipboard.writeText == 'function') {
      log('trying to write text to clipboard via Clipboard API');
      try {
        return navigator.clipboard.writeText(plainText);
      }
      catch(e) {
        log('failed to write text to clipboard: ', e);
      }
    }
    else if (richText &&
             typeof navigator.clipboard.write == 'function') {
      log('trying to write data to clipboard via Clipboard API');
      try {
        const dt = new DataTransfer();
        dt.items.add('text/plain', plainText);
        dt.items.add('text/html',  richText);
        return navigator.clipboard.write(dt);
      }
      catch(e) {
        log('failed to write data to clipboard: ', e);
      }
    }
  }

  const doCopy = function() {
    if (richText) {
      // This block won't work if dom.event.clipboardevents.enabled=false.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1396275
      document.addEventListener('copy', event => {
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData.setData('text/plain', plainText);
        event.clipboardData.setData('text/html',  richText);
      }, {
        once:    true,
        capture: true
      });
      document.execCommand('copy');
    }
    else {
      // this is still required to block overriding clipboard data from scripts of the webpage.
      document.addEventListener('copy', event => {
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData.setData('text/plain', plainText);
      }, {
        capture: true,
        once: true
      });
      const field = document.createElement('textarea');
      field.setAttribute('style', 'position:fixed; top:0; left:0; opacity:0');
      field.value = plainText;
      document.body.appendChild(field);
      field.focus();
      field.select();
      document.execCommand('copy');
      field.parentNode.removeChild(field);
    }
  };

  if (!configs.useWorkaroundForBug1272869) {
    log('trying to write data to clipboard via execCommand from current page');
    doCopy();
    return;
  }

  log('trying to write data to clipboard via execCommand from content page');
  let permittedTabs = tabs.filter(Permissions.isPermittedTab);
  if (permittedTabs.length == 0) {
    permittedTabs = allTabs.filter(Permissions.isPermittedTab);
    if (permittedTabs.length == 0)
      throw new Error('no permitted tab to copy data to the clipboard');
  }
  browser.tabs.executeScript(permittedTabs[0].id, {
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
      {
        let richText = ${JSON.stringify(richText)};
        let plainText = ${JSON.stringify(plainText)};
        (${doCopy.toString()})();
      }
    `
  });
}

export async function fillPlaceHolders(format, tab, indentLevel) {
  log('fillPlaceHolders ', tab.id, format, indentLevel);
  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  let contentsData = {};
  if (!tab.discarded &&
      Permissions.isPermittedTab(tab) &&
      /%(AUTHOR|DESC(?:RIPTION)?|KEYWORDS)(?:_HTML(?:IFIED)?)?%/i.test(format)) {
    log('trying to get data from content ', tab.id);
    contentsData = await browser.tabs.executeScript(tab.id, {
      file: '/common/get-content-text.js'
    });
    if (Array.isArray(contentsData))
      contentsData = contentsData[0];
    log('contentsData ', contentsData);
  }
  const now = new Date();
  const timeUTC = now.toUTCString();
  const timeLocal = now.toLocaleString();
  const formatted = format
    .replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
    .replace(/%URL%/gi, tab.url)
    .replace(/%(?:TITLE|TEXT)%/gi, tab.title)
    .replace(/%URL_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.url))
    .replace(/%TITLE_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.title))
    .replace(/%AUTHOR%/gi, contentsData.author || '')
    .replace(/%AUTHOR_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.author || ''))
    .replace(/%DESC(?:RIPTION)?%/gi, contentsData.description || '')
    .replace(/%DESC(?:RIPTION)?_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.description || ''))
    .replace(/%KEYWORDS%/gi, contentsData.keywords || '')
    .replace(/%KEYWORDS_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.keywords || ''))
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

  if (/%RT%/i.test(format)) {
    return {
      richText:  formatted.trim() && formatted ||
                   `<a href="${sanitizeHtmlText(tab.url)}">${sanitizeHtmlText(tab.title)}</a>`,
      plainText: formatted.trim() && formatted ||
                   `${tab.title}<${tab.url}>`
    };
  }
  return {
    richText:  '',
    plainText: formatted
  };
}

export function sanitizeHtmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function saveTabs(ids) {
  const tabs = await getTabsByIds(ids);
  let prefix = configs.saveTabsPrefix;
  prefix = `${prefix.replace(/\/$/, '')}/`;
  const alreadyUsedNames = new Set();
  for (const tab of tabs) {
    if (ids.indexOf(tab.id) > -1)
      browser.downloads.download({
        url:      tab.url,
        filename: `${prefix}${await suggestUniqueFileNameForTab(tab, alreadyUsedNames)}`
      });
  }
}

async function suggestUniqueFileNameForTab(tab, alreadyUsedNames) {
  let name = await suggestFileNameForTab(tab);
  if (!alreadyUsedNames.has(name)) {
    alreadyUsedNames.add(name);
    return name;
  }
  const WITH_SUFFIX_MATCHER = /(-(\d+)(\.?[^\.]+))$/;
  let matched = name.match(WITH_SUFFIX_MATCHER);
  if (!matched) {
    name = name.replace(/(\.?[^\.]+)$/, '-0$1');
    matched = name.match(WITH_SUFFIX_MATCHER);
  }
  let count = parseInt(matched[2]);
  while (true) {
    count++;
    const newName = name.replace(matched[1], `-${count}${matched[3]}`);
    if (alreadyUsedNames.has(newName))
      continue;
    alreadyUsedNames.add(newName);
    return newName;
  }
}

const kMAYBE_IMAGE_PATTERN    = /\.(jpe?g|png|gif|bmp|svg)/i;
const kMAYBE_RAW_FILE_PATTERN = /\.(te?xt|md)/i;

async function suggestFileNameForTab(tab) {
  const fileNameMatch = tab.url
    .replace(/^\w+:\/\/[^\/]+\//, '') // remove origin part
    .replace(/#.*$/, '') // remove fragment
    .replace(/\?.*$/, '') // remove query
    .match(/([^\/]+\.([^\.\/]+))$/);
  log('suggestFileNameForTab ', tab.id, fileNameMatch);
  if (fileNameMatch &&
      (kMAYBE_IMAGE_PATTERN.test(fileNameMatch[1]) ||
       kMAYBE_RAW_FILE_PATTERN.test(fileNameMatch[1])))
    return fileNameMatch[1];

  let suggestedExtension = '';
  if (!tab.discarded &&
      Permissions.isPermittedTab(tab)) {
    log(`getting content type of ${tab.id}`);
    if (!(await Permissions.isGranted(Permissions.ALL_URLS))) {
      notify({
        title:   browser.i18n.getMessage('notPermitted_allUrls_title'),
        message: browser.i18n.getMessage('notPermitted_allUrls_message')
      });
    }
    else {
      let contentType = await browser.tabs.executeScript(tab.id, {
        code: `document.contentType`
      });
      if (Array.isArray(contentType))
        contentType = contentType[0];
      log(`contentType of ${tab.id}: `, contentType);
      if (/^(text\/html|application\/xhtml\+xml)/.test(contentType)) {
        suggestedExtension = '.html';
      }
      else if (/^text\//.test(contentType)) {
        suggestedExtension = '.txt';
      }
      else if (/^image\//.test(contentType)) {
        suggestedExtension = `.${contentType.replace(/^image\/|\+.+$/g, '')}`;
      }
    }
  }
  log('suggestedExtension: ', tab.id, suggestedExtension);
  const fileName = `${tab.title.replace(/[\/\\:*?"<>|]/g, '_')}${suggestedExtension}`;
  log('finally suggested fileName: ', tab.id, fileName);
  return fileName;
}

export async function suspendTabs(ids, _options = {}) {
  if (typeof browser.tabs.discard != 'function')
    throw new Error('Error: required API "tabs.discard()" is not available on this version of Firefox.');
  const tabs = await getTabsByIds(ids);
  const allTabs = await browser.tabs.query({ windowId: tabs[0].windowId });
  let inSelection = false;
  let selectionFound = false;
  let unselectedTabs = [];
  let nextFocusedTab = null;
  for (const tab of allTabs) {
    if (tab.active && ids.indexOf(tab.id) < 0) {
      nextFocusedTab = null;
      unselectedTabs = [];
      break;
    }
    if (!inSelection && ids.indexOf(tab.id) > -1) {
      inSelection = true;
      selectionFound = true;
    }
    else if (inSelection && ids.indexOf(tab.id) < 0) {
      inSelection = false;
    }
    if (selectionFound && !inSelection && !tab.discarded) {
      nextFocusedTab = tab;
      break;
    }
    if (!inSelection && !selectionFound)
      unselectedTabs.push(tab);
  }
  if (!nextFocusedTab && unselectedTabs.length > 0) {
    for (const tab of unselectedTabs.reverse()) {
      if (tab.discarded)
        continue;
      nextFocusedTab = tab;
      break;
    }
  }
  if (nextFocusedTab)
    await browser.tabs.update(nextFocusedTab.id, { active: true });
  return browser.tabs.discard(ids);
}

export async function resumeTabs(ids) {
  const selectedTabs = await getTabsByIds(ids);
  const allTabs = await browser.tabs.query({ windowId: selectedTabs[0].windowId });
  const activeTab = allTabs.filter(tab => tab.active)[0];
  for (const tab of selectedTabs) {
    //if (tab.discarded)
    await browser.tabs.update(tab.id, { active: true });
  }
  return browser.tabs.update(activeTab.id, { active: true });
}
