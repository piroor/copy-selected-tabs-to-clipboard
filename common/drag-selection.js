/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
  handleMissingReceiverError
} from './common.js';
import * as Constants from './constants.js';
import * as Selections from './selections.js';
import EventListenerManager from '/extlib/EventListenerManager.js';
import TabIdFixer from '/extlib/TabIdFixer.js';

export const onDragSelectionEnd = new EventListenerManager();

export const mDragSelection = {
  selection:             null,
  willCloseSelectedTabs: false,
  allTabsOnDragReady:    [],
  pendingTabs:           null,
  dragStartTarget:       null,
  lastHoverTarget:       null,
  firstHoverTarget:      null,
  undeterminedRange:     {},
  dragEnteredCount:      0,
  cancel() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange = {};
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
  },
  clear() {
    this.cancel();
    this.selection = null;
  },
  export() {
    const exported = {};
    for (const key of Object.keys(this)) {
      if (key != 'selection' &&
          typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(foreignSession) {
    for (const key of Object.keys(foreignSession)) {
      if (typeof this[key] != 'function')
        this[key] = foreignSession[key];
    }
  }
};

export function serialize() {
  return mDragSelection.export();
}

export function apply(dragSelection) {
  return mDragSelection.apply(dragSelection);
}

export function getDragStartTargetId() {
  return mDragSelection.dragStartTarget && mDragSelection.dragStartTarget.id;
}

export function activateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = true;
}

export function deactivateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = false;
}

export function isActivatedInVerticalTabbarOfTST() {
  return !!mDragSelection.activatedInVerticalTabbarOfTST;
}

/* utilities */

function retrieveTargetTabs(serializedTab, force = false) {
  let tabs = [serializedTab];
  if (serializedTab.children &&
      (force || serializedTab.states.indexOf('subtree-collapsed') > -1)) {
    for (const tab of serializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab, true))
    }
  }
  return tabs;
}

function getTabsBetween(aBegin, end, allTabs = []) {
  if (aBegin.id == end.id)
    return [];
  let inRange = false;
  return allTabs.filter(tab => {
    if (tab.id == aBegin.id || tab.id == end.id) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

function toggleStateOfDragOverTabs(params = {}) {
  if (mDragSelection.firstHoverTarget) {
    const oldUndeterminedRange = mDragSelection.undeterminedRange;
    mDragSelection.undeterminedRange = {};

    let newUndeterminedRange = params.allTargets;
    if (newUndeterminedRange.every(tab => tab.id != mDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(mDragSelection.firstHoverTarget);

    const betweenTabs = getTabsBetween(mDragSelection.firstHoverTarget, params.target, mDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(id => parseInt(id));
    const newUndeterminedRangeIds = newUndeterminedRange.map(tab => tab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(id => newUndeterminedRangeIds.indexOf(id) < 0);
    {
      const toBeSelected   = [];
      const toBeDeselected = [];
      for (const id of outOfRangeTabIds) {
        if (mDragSelection.selection.contains(id))
          toBeDeselected.push(oldUndeterminedRange[id]);
        else
          toBeSelected.push(oldUndeterminedRange[id]);
      }
      if (toBeSelected.length > 0) {
        mDragSelection.selection.set(toBeSelected, true, {
          globalHighlight: false,
          dontUpdateMenu: true,
          state: params.state
        });
      }
      if (toBeDeselected.length > 0) {
        mDragSelection.selection.set(toBeDeselected, false, {
          globalHighlight: false,
          dontUpdateMenu: true,
          state: params.state
        });
      }
    }

    {
      const toBeSelected   = [];
      const toBeDeselected = [];
      for (const tab of newUndeterminedRange) {
        if (tab.id in mDragSelection.undeterminedRange)
          continue;
        mDragSelection.undeterminedRange[tab.id] = tab;
        if (oldUndeterminedRangeIds.indexOf(tab.id) > -1)
          continue;
        if (mDragSelection.selection.contains(tab))
          toBeDeselected.push(tab);
        else
          toBeSelected.push(tab);
      }
      if (toBeSelected.length > 0) {
        mDragSelection.selection.set(toBeSelected, true, {
          globalHighlight: false,
          dontUpdateMenu: true,
          state: params.state
        });
      }
      if (toBeDeselected.length > 0) {
        mDragSelection.selection.set(toBeDeselected, false, {
          globalHighlight: false,
          dontUpdateMenu: true,
          state: params.state
        });
      }
    }
  }
  else {
    for (const tab of params.allTargets) {
      mDragSelection.undeterminedRange[tab.id] = tab;
    }
    mDragSelection.selection.set(params.allTargets, !mDragSelection.selection.contains(params.target.id), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: params.state
    });
  }
}


/* select tabs by clicking */

let gInSelectionSession = false;

export async function onClick(message) {
  if (message.button != 0)
    return false;

  mDragSelection.selection = Selections.get(message.window);

  let selected = false;
  {
    if (message.tab.states)
      selected = message.tab.states.indexOf('selected') > -1;
    else
      selected = !!mDragSelection.selection.contains(message.tab.id);
  }

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !message.shiftKey) {
    if (!selected) {
      mDragSelection.selection.clear({
        states: ['selected', 'ready-to-close']
      });
    }
    gInSelectionSession = false;
    mDragSelection.selection.setLastClickedTab(null);
    return;
  }

  const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: message.window
  }))[0];
  if (lastActiveTab)
    TabIdFixer.fixTab(lastActiveTab);

  let tabs = retrieveTargetTabs(message.tab);
  if (message.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const window = await browser.windows.get(message.window, { populate: true });
    const betweenTabs = getTabsBetween(mDragSelection.selection.getLastClickedTab() || lastActiveTab, message.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(mDragSelection.selection.getLastClickedTab() || lastActiveTab);
    const selectedTabIds = tabs.map(tab => tab.id);
    if (!ctrlKeyPressed)
      mDragSelection.selection.set(window.tabs.filter(tab => selectedTabIds.indexOf(tab.id) < 0), false, {
        globalHighlight: false
      });
    mDragSelection.selection.set(tabs, true, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const newSelectedTabIds = mDragSelection.selection.getSelectedTabIds();
    if (newSelectedTabIds.length > 0 && !newSelectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(mDragSelection.selection.getLastClickedTab() ? mDragSelection.selection.getLastClickedTab().id : newSelectedTabIds[0], { active: true });
    return true;
  }
  else if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    if (message.tab.id != lastActiveTab.id ||
        !gInSelectionSession) {
      mDragSelection.selection.set(lastActiveTab, true, {
        globalHighlight: false
      });
      if (configs.enableIntegrationWithTST)
        await setSelectedStateToCollapsedDescendants(lastActiveTab, true);
    }
    mDragSelection.selection.set(tabs, !selected, {
      globalHighlight: false
    });
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const selectedTabIds = mDragSelection.selection.getSelectedTabIds();
    if (selectedTabIds.length > 0 && !selectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(selectedTabIds[0], { active: true });
    gInSelectionSession = true;
    mDragSelection.selection.setLastClickedTab(message.tab);
    return true;
  }
  return false;
}

async function setSelectedStateToCollapsedDescendants(tab, selected) {
  const tree = await browser.runtime.sendMessage(Constants.kTST_ID, {
    type: Constants.kTSTAPI_GET_TREE,
    tab:  tab.id
  }).catch(handleMissingReceiverError);
  if (!tree || !tree.states.includes('subtree-collapsed'))
    return;
  const treeTabs = collectTabsRecursively(tree);
  mDragSelection.selection.set(treeTabs, selected, {
    globalHighlight: false
  });
}
function collectTabsRecursively(tab) {
  let tabs = [tab];
  if (tab.children) {
    for (const child of tab.children) {
      tabs = tabs.concat(collectTabsRecursively(child));
    }
  }
  return tabs;
}

export async function onMouseUp(message) {
  if (message.button != 0)
    return false;

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !message.shiftKey &&
      !mDragSelection.dragStartTarget) {
    mDragSelection.selection.clear({
      states: ['selected', 'ready-to-close']
    });
  }
}

export async function onNonTabAreaClick(message) {
  if (message.button != 0)
    return;
  mDragSelection.selection.clear({
    states: ['selected', 'ready-to-close']
  });
  mDragSelection.clear();
}


/* select tabs by dragging */

export async function onDragReady(message) {
  //console.log('onDragReady', message);
  mDragSelection.undeterminedRange = {};
  mDragSelection.selection = Selections.get(message.window);
  mDragSelection.dragEnteredCount = 1;
  mDragSelection.willCloseSelectedTabs = message.startOnClosebox;
  mDragSelection.pendingTabs = null;
  mDragSelection.dragStartTarget = mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = message.tab;
  mDragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: message.window })).map(TabIdFixer.fixTab);

  mDragSelection.selection.clear({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  const startTabs = retrieveTargetTabs(message.tab);
  mDragSelection.selection.set(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: mDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (const tab of startTabs) {
    mDragSelection.undeterminedRange[tab.id] = tab;
  }
}

export async function onDragCancel(message) {
  //console.log('onDragCancel', message);
  if (mDragSelection.selection.has()) {
    onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    mDragSelection.selection
    });
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.cancel();
}

export async function onDragStart(_message) {
  //console.log('onDragStart', message);
}

export async function onDragEnter(message) {
  //console.log('onDragEnter', message, message.tab == mDragSelection.lastHoverTarget);
  mDragSelection.dragEnteredCount++;
  // processAutoScroll(event);

  if (mDragSelection.lastHoverTarget &&
      message.tab.id == mDragSelection.lastHoverTarget.id)
    return;

  const state = mDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (mDragSelection.pendingTabs) {
    mDragSelection.selection.set(mDragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    mDragSelection.pendingTabs = null;
  }
  /*
  if (mDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  const targetTabs = retrieveTargetTabs(message.tab);
  toggleStateOfDragOverTabs({
    target:     message.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (message.tab.id == mDragSelection.dragStartTarget.id &&
      mDragSelection.selection.count() == targetTabs.length) {
    mDragSelection.selection.set(targetTabs, false, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    for (const tab of targetTabs) {
      mDragSelection.undeterminedRange[tab.id] = tab;
    }
    mDragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(message.tab.id, { active: true });
  }
  */
  mDragSelection.lastHoverTarget = message.tab;
  if (!mDragSelection.firstHoverTarget)
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget;
}

export async function onDragExit(_message) {
  mDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+mDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (mDragSelection.dragEnteredCount <= 0) {
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = null;
    mDragSelection.undeterminedRange = {};
  }
}
dragExitAllWithDelay.reserve = () => {
  dragExitAllWithDelay.cancel();
  dragExitAllWithDelay.timeout = setTimeout(() => {
    dragExitAllWithDelay();
  }, 10);
};
dragExitAllWithDelay.cancel = () => {
  if (dragExitAllWithDelay.timeout) {
    clearTimeout(dragExitAllWithDelay.timeout);
    delete dragExitAllWithDelay.timeout;
  }
};

export async function onDragEnd(message) {
  //console.log('onDragEnd', message);
  if (mDragSelection.willCloseSelectedTabs) {
    const allTabs = mDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    const toBeClosedIds = mDragSelection.selection.getSelectedTabIds();
    for (const tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    mDragSelection.selection.clear();
  }
  else if (mDragSelection.selection.has()) {
    await onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    mDragSelection.selection
    });
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.cancel();
}
