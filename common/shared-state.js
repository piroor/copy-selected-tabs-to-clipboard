/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Selections from './selections.js';
import * as DragSelection from './drag-selection.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

export const onUpdated = new EventListenerManager();

const kCOMMAND_PULL = 'multipletab:shared-state:pull';
const kCOMMAND_PUSH = 'multipletab:shared-state:push';

let mWindowId = null;

export function initAsMaster() {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message || !message.type)
      return;

    switch (message.type) {
      case kCOMMAND_PULL:
        return Promise.resolve(serialize(message.windowId));
    }
  });
}

export async function initAsSlave(windowId) {
  mWindowId = windowId;
  const state = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL,
    windowId
  });
  await apply(windowId, state);
}

function reservePush(windowId) {
  let timer = reservePush.reserved.get(windowId);
  if (timer)
    clearTimeout(timer);
  timer = setTimeout(() => {
    push(windowId);
  }, 150);
  reservePush.reserved.set(windowId, timer)
}
reservePush.reserved = new Map();

export async function push(windowId, extraInfo = {}) {
  if (!windowId)
    windowId = mWindowId;
  const timer = reservePush.reserved.get(windowId);
  if (timer) {
    clearTimeout(timer);
    reservePush.reserved.delete(windowId)
  }
  await browser.runtime.sendMessage({
    type:  kCOMMAND_PUSH,
    state: serialize(windowId),
    windowId,
    extraInfo
  }).catch(_error => { /* ignore error from no opening panel */ });
}

function serialize(windowId) {
  if (!windowId)
    windowId = mWindowId;
  return {
    selection: Selections.get(windowId).serialize(),
    dragSelection: DragSelection.serialize()
  };
}

async function apply(windowId, selections, extraInfo = {}) {
  if (!windowId)
    windowId = mWindowId;
  Selections.get(windowId).apply(selections.selection);
  DragSelection.apply(selections.dragSelection);
  await onUpdated.dispatch(windowId, extraInfo);
}


browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case kCOMMAND_PUSH:
      return apply(message.windowId, message.state, message.extraInfo);

    default:
      break;
  }
});

Selections.onCreated.addListener(selection => {
  selection.onChange.addListener((_tabs, _selected, _options = {}) => {
    reservePush(selection.windowId);
  });
});
