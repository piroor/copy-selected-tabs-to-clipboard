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
    Permissions.CONTEXTUAL_IDENTITIES,
    document.querySelector('#contextualIdentitiesPermissionGranted')
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
      .map((format, index) => createFormatRow({ ...format, index }))
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
  let added = false;
  const formats = JSON.parse(JSON.stringify(configs.copyToClipboardFormats));
  for (const defaultFormat of configs.$default.copyToClipboardFormats) {
    if (formats.some(format => format.label == defaultFormat.label && format.format == defaultFormat.format))
      continue;
    formats.push({
      ...defaultFormat,
      id:      createNewId(),
      enabled: true
    });
    added = true;
  }
  if (!added)
    return;
  configs.copyToClipboardFormats = formats;
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
