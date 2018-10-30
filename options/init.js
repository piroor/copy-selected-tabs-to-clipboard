/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from '/common/common.js';
import * as Permissions from '/common/permissions.js';
import Options from '/extlib/Options.js';
import ShortcutCustomizeUI from '/extlib/ShortcutCustomizeUI.js';
import '../extlib/l10n.js';

log.context = 'Options';
const options = new Options(configs);

let gFormatRows;

function onConfigChanged(key) {
  switch (key) {
    case 'debug':
      if (configs.debug)
        document.documentElement.classList.add('debugging');
      else
        document.documentElement.classList.remove('debugging');
      break;
  }
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', () => {
  // remove accesskey mark
  for (const label of Array.slice(document.querySelectorAll('#menu-items label, #bookmarksPermissionCheck, #clipboardWritePermissionCheck'))) {
    label.lastChild.nodeValue = label.lastChild.nodeValue.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
  }

  gFormatRows = document.querySelector('#copyToClipboardFormatsRows');
  gFormatRows.addEventListener('input', onFormatInput);
  addButtonCommandListener(
    gFormatRows,
    (event) => { onRowControlButtonClick(event); }
  );
  addButtonCommandListener(
    document.querySelector('#copyToClipboardFormatsAddNewRow'),
    (_event) => { addFormatRow(); }
  );
  addButtonCommandListener(
    document.querySelector('#copyToClipboardFormatsRestoreDefaults'),
    (_event) => { restoreDefaultFormats(); }
  );

  ShortcutCustomizeUI.build().then(aUI => {
    document.getElementById('shortcuts').appendChild(aUI);
  });

  configs.$loaded.then(() => {
    Permissions.bindToCheckbox(
      Permissions.BOOKMARKS,
      document.querySelector('#bookmarksPermissionGranted')
    );
    Permissions.bindToCheckbox(
      Permissions.CLIPBOARD_WRITE,
      document.querySelector('#clipboardWritePermissionGranted')
    );

    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
    rebuildFormatRows();
    initCollapsibleSections();
  });
}, { once: true });


function getButtonFromEvent(event) {
  let target = event.target;
  if (target.nodeType != Node.ELEMENT_NODE)
    target = target.parentNode;
  return target.localName == 'button' && target;
}

function addButtonCommandListener(aButton, aOnCommand) {
  aButton.addEventListener('click', (event) => {
    if (!getButtonFromEvent(event))
      return;
    aOnCommand(event);
  });
  aButton.addEventListener('keyup', (event) => {
    if (!getButtonFromEvent(event))
      return;
    if (event.key == 'Enter')
      aOnCommand(event);
  });
}

function getInputFieldFromEvent(event) {
  let target = event.target;
  if (target.nodeType != Node.ELEMENT_NODE)
    target = target.parentNode;
  return target.localName == 'input' && target;
}

function onFormatInput(event) {
  const field = getInputFieldFromEvent(event);
  if (!field)
    return;
  if (field.throttleInputTimer)
    clearTimeout(field.throttleInputTimer);
  field.throttleInputTimer = setTimeout(() => {
    delete field.throttleInputTimer;
    const row = field.parentNode;
    const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
    const item = formats[row.itemIndex];
    if (field.classList.contains('label'))
      item.label = field.value;
    else if (field.classList.contains('format'))
      item.format = field.value;
    else
      return;
    configs.copyToClipboardFormats = formats;
  }, 250);
}

function rebuildFormatRows() {
  const range = document.createRange();
  range.selectNodeContents(gFormatRows);
  range.deleteContents();

  const rows = document.createDocumentFragment();
  if (!Array.isArray(configs.copyToClipboardFormats)) { // migrate to array
    const items = [];
    for (const label of Object.keys(configs.copyToClipboardFormats)) {
      items.push({
        label:  label,
        format: configs.copyToClipboardFormats[label]
      });
    }
    configs.copyToClipboardFormats = items;
  }
  configs.copyToClipboardFormats.forEach((item, index) => {
    rows.appendChild(createFormatRow({
      index:  index,
      label:  item.label,
      format: item.format
    }));
  });
  range.insertNode(rows);

  range.detach();
}

function addFormatRow() {
  const formats = configs.copyToClipboardFormats;
  const row = gFormatRows.appendChild(createFormatRow({
    index: formats.length
  }));
  row.querySelector('input.label').focus();
  formats.push({ label: '', format: '' });
  configs.copyToClipboardFormats = formats;
}

function restoreDefaultFormats() {
  const checked = {};
  const unifiedFormats = configs.$default.copyToClipboardFormats.concat(configs.copyToClipboardFormats);
  const uniqueFormats = [];
  for (const format of unifiedFormats) {
    const key = JSON.stringify(format);
    if (key in checked)
      continue;
    checked[key] = true;
    uniqueFormats.push(format);
  }
  configs.copyToClipboardFormats = uniqueFormats;
  rebuildFormatRows();
}

function createFormatRow(params = {}) {
  const row = document.createElement('div');
  row.classList.add('row');
  row.itemIndex= params.index;

  const labelField = row.appendChild(document.createElement('input'));
  labelField.classList.add('column');
  labelField.classList.add('label');
  labelField.setAttribute('type', 'text');
  labelField.setAttribute('placeholder', browser.i18n.getMessage('config_copyToClipboardFormats_label'));
  if (params.label)
    labelField.value = params.label;

  const formatField = row.appendChild(document.createElement('input'));
  formatField.classList.add('column');
  formatField.classList.add('format');
  formatField.setAttribute('type', 'text');
  formatField.setAttribute('placeholder', browser.i18n.getMessage('config_copyToClipboardFormats_template'));
  if (params.format)
    formatField.value = params.format;

  const upButton = row.appendChild(document.createElement('button'));
  upButton.classList.add('column');
  upButton.classList.add('up');
  upButton.setAttribute('title', browser.i18n.getMessage('config_copyToClipboardFormats_up'));
  upButton.appendChild(document.createTextNode('▲'));

  const downButton = row.appendChild(document.createElement('button'));
  downButton.classList.add('column');
  downButton.classList.add('down');
  downButton.setAttribute('title', browser.i18n.getMessage('config_copyToClipboardFormats_down'));
  downButton.appendChild(document.createTextNode('▼'));

  const removeButton = row.appendChild(document.createElement('button'));
  removeButton.classList.add('column');
  removeButton.classList.add('remove');
  removeButton.setAttribute('title', browser.i18n.getMessage('config_copyToClipboardFormats_remove'));
  removeButton.appendChild(document.createTextNode('✖'));

  return row;
}

function onRowControlButtonClick(event) {
  const button = getButtonFromEvent(event);
  const row = button.parentNode;
  const formats = configs.copyToClipboardFormats;
  const item = formats[row.itemIndex];
  if (button.classList.contains('remove')) {
    formats.splice(row.itemIndex, 1);
    configs.copyToClipboardFormats = formats;
    row.parentNode.removeChild(row);
  }
  else if( button.classList.contains('up')) {
    if (row.itemIndex > 0) {
      formats.splice(row.itemIndex, 1);
      formats.splice(row.itemIndex - 1, 0, item);
      configs.copyToClipboardFormats = formats;
      row.parentNode.insertBefore(row, row.previousSibling);
    }
  }
  else if( button.classList.contains('down')) {
    if (row.itemIndex < formats.length - 1) {
      formats.splice(row.itemIndex, 1);
      formats.splice(row.itemIndex + 1, 0, item);
      configs.copyToClipboardFormats = formats;
      row.parentNode.insertBefore(row, row.nextSibling.nextSibling);
    }
  }
  Array.slice(row.parentNode.childNodes).forEach((aRow, index) => {
    aRow.itemIndex = index;
  });
}


function initCollapsibleSections() {
  for (const heading of Array.slice(document.querySelectorAll('body > section > h1'))) {
    const section = heading.parentNode;
    section.style.maxHeight = `${heading.offsetHeight}px`;
    if (configs.optionsExpandedSections.indexOf(section.id) < 0)
      section.classList.add('collapsed');
    heading.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      const otherExpandedSections = configs.optionsExpandedSections.filter(id => id != section.id);
      if (section.classList.contains('collapsed'))
        configs.optionsExpandedSections = otherExpandedSections;
      else
        configs.optionsExpandedSections = otherExpandedSections.concat([section.id]);
    });
  }
}
