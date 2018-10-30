/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Selection from './selection.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

export const onCreated = new EventListenerManager();

const mSelections = new Map();

export function get(windowId) {
  let selection = mSelections.get(windowId);
  if (!selection) {
    selection = new Selection(windowId);
    mSelections.set(windowId, selection);
    onCreated.dispatch(selection);
  }
  return selection;
}

export function getAll() {
  return Array.from(mSelections.values());
}

export async function getActive() {
  return get((await browser.windows.getLastFocused()).id);
}

browser.windows.onRemoved.addListener(windowId => {
  if (!mSelections.has(windowId))
    return;
  const selection = mSelections.get(windowId);
  selection.onChanged.removeAllListeners();
  selection.clear();
  mSelections.delete(windowId);
});
