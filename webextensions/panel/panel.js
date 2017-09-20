/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Panel';

var gTabBar;

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;
  var response = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL_SELECTION_INFO
  });
  gSelection = response.selection;
  gDragSelection = response.dragSelection;

  browser.tabs.onActivated.addListener(onTabModified);
  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);
  browser.runtime.onMessage.addListener(onMessage);

  gTabBar = document.querySelector('#tabs');
  await rebuildTabItems();
}, { once: true });

window.addEventListener('unload', () => {
  browser.tabs.onActivated.removeListener(onTabModified);
  browser.tabs.onCreated.removeListener(onTabModified);
  browser.tabs.onRemoved.removeListener(onTabModified);
  browser.runtime.onMessage.removeListener(onMessage);
}, { once: true });

function onTabModified() {
  clearSelection();
}

function onMessage(aMessage) {
  if (!aMessage || !aMessage.type)
    return;

  switch (aMessage.type) {
    case kCOMMAND_PUSH_SELECTION_INFO:
      gSelection = aMessage.selection;
      gDragSelection = aMessage.dragSelection;
      rebuildTabItems();
      break;
  }
}

function onSelectionChange(aOptions = {}) {
  reservePushSelectionState();
}

async function rebuildTabItems() {
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  range.deleteContents();
  var fragment = document.createDocumentFragment();
  var tabs = await browser.tabs.query({ currentWindow: true });
  for (let tab of tabs) {
    let tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(aTab) {
  var label = document.createElement('label');
  var checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (aTab.id in gSelection.tabs)
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', () => {
    item.classList.toggle('selected');
    setSelection(aTab, item.classList.contains('selected'));
  });
  label.appendChild(checkbox);
  var favicon = document.createElement('img');
  favicon.setAttribute('src', aTab.favIconUrl);
  label.appendChild(favicon);
  label.appendChild(document.createTextNode(aTab.title));
  var item = document.createElement('li');
  item.appendChild(label);
  if (aTab.id in gSelection.tabs)
    item.classList.add('selected');
  return item;
}