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
import { DOMUpdater } from '/extlib/dom-updater.js';
import '/extlib/l10n.js';

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
window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  // migrate to array
  if (!Array.isArray(configs.copyToClipboardFormats)) {
    const formats = [];
    for (const label of Object.keys(configs.copyToClipboardFormats)) {
      formats.push({
        label:   label,
        format:  configs.copyToClipboardFormats[label],
        id:      createNewId(),
        enabled: true
      });
    }
    configs.copyToClipboardFormats = formats;
  }

  // migrate formats
  if (configs.copyToClipboardFormats.some(format => !('id' in format) || !('enabled' in format))) {
    const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
    for (const format of formats) {
      if (!('id' in format))
        format.id = createNewId();
      if (!('enabled' in format))
        format.enabled = true;
    }
    configs.copyToClipboardFormats = formats;
  }

  gFormatRows = document.querySelector('#copyToClipboardFormatsRows');
  gFormatRows.addEventListener('input', onFormatInput);
  gFormatRows.addEventListener('change', onFormatInput);
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

  Permissions.bindToCheckbox(
    Permissions.ALL_URLS,
    document.querySelector('#allUrlsPermissionGranted')
  );

  options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
  onConfigChanged('debug');
  rebuildFormatRows();

  document.documentElement.classList.add('initialized');
}, { once: true });


function getButtonFromEvent(event) {
  let target = event.target;
  if (target.nodeType != Node.ELEMENT_NODE)
    target = target.parentNode;
  return target.localName == 'button' && target;
}

function addButtonCommandListener(button, onCommand) {
  button.addEventListener('click', (event) => {
    if (!getButtonFromEvent(event))
      return;
    onCommand(event);
  });
  button.addEventListener('keyup', (event) => {
    if (!getButtonFromEvent(event))
      return;
    if (event.key == 'Enter')
      onCommand(event);
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
    const row = field.closest('.row');
    const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
    const item = formats[row.dataset.index];
    if (field.classList.contains('label'))
      item.label = field.value;
    else if (field.classList.contains('format'))
      item.format = field.value;
    else if (field.classList.contains('enabled'))
      item.enabled = field.checked;
    else
      return;
    configs.copyToClipboardFormats = formats;
  }, 250);
}

function rebuildFormatRows() {
  const range = document.createRange();
  range.selectNodeContents(gFormatRows);
  const contents = range.createContextualFragment(
    configs.copyToClipboardFormats
      .map((format, index) =>
        createFormatRow(Object.assign({}, format, { index })))
      .join('')
  );
  range.detach();
  DOMUpdater.update(gFormatRows, contents);
}

function addFormatRow() {
  configs.copyToClipboardFormats = configs.copyToClipboardFormats.concat([{
    label:   '',
    format:  '',
    id:      createNewId(),
    enabled: true
  }]);
  rebuildFormatRows();
  gFormatRows.querySelector(`div.row[data-index="${configs.copyToClipboardFormats.length - 1}"] input.label`).focus();
}

function createNewId() {
  return `format-${Date.now()}-${Math.round(Math.random() * 65000)}`;
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

function createFormatRow({ id, index, label, format, enabled } = {}) {
  return `
    <div id="row-${id}"
         class="row"
         data-index="${index}">
      <input type="checkbox"
             class="enabled"
             title="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_enabled'))}"
             ${enabled ? 'checked' : ''}>
      <span class="fields column">
        <input type="text"
               class="label"
               placeholder="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_label'))}"
               value="${label ? sanitizeForHTML(label) : ''}">
        <input type="text"
               class="format"
               placeholder="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_template'))}"
               value="${format ? sanitizeForHTML(format) : ''}">
      </span>
      <span class="buttons column">
        <button class="up"
                title="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_up'))}"
                >▲</button>
        <button class="down"
                title="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_down'))}"
                >▼</button>
        <button class="remove"
                title="${sanitizeForHTML(browser.i18n.getMessage('config_copyToClipboardFormats_remove'))}"
                >✖</button>
      </span>
    </div>
  `.trim();
}

function sanitizeForHTML(string) {
  return string.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function onRowControlButtonClick(event) {
  const button = getButtonFromEvent(event);
  const row = button.closest('.row');
  const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
  const rowIndex = parseInt(row.dataset.index);
  const item = formats[rowIndex];
  if (button.classList.contains('remove')) {
    formats.splice(rowIndex, 1);
    configs.copyToClipboardFormats = formats;
    rebuildFormatRows();
  }
  else if (button.classList.contains('up')) {
    if (rowIndex > 0) {
      formats.splice(rowIndex, 1);
      formats.splice(rowIndex - 1, 0, item);
      configs.copyToClipboardFormats = formats;
      rebuildFormatRows();
    }
  }
  else if (button.classList.contains('down')) {
    if (rowIndex < formats.length - 1) {
      formats.splice(rowIndex, 1);
      formats.splice(rowIndex + 1, 0, item);
      configs.copyToClipboardFormats = formats;
      rebuildFormatRows();
    }
  }
}
