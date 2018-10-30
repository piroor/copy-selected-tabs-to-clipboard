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
import * as Permissions from './permissions.js';

import EventListenerManager from '/extlib/EventListenerManager.js';
import TabIdFixer from '/extlib/TabIdFixer.js';

export default class Selection {
  constructor(windowId) {
    if (!windowId)
      throw new Error('Selection must have a window ID');
    this.mTabs = {};
    this.mTargetWindow = windowId;
    this.mLastClickedTab = null;

    this.onChange = new EventListenerManager();
  }

  get windowId() {
    return this.mTargetWindow;
  }

  serialize() {
    return {
      tabs: this.mTabs,
      targetWindow: this.mTargetWindow,
      lastClickedTab: this.mLastClickedTab
    };
  }

  apply(foreignSelection) {
    const oldTabs = this.mTabs;
    if ('tabs' in foreignSelection)
      this.mTabs = foreignSelection.tabs;
    if ('lastClickedTab' in foreignSelection)
      this.mLastClickedTab = foreignSelection.lastClickedTab;
    const newlySelected   = Object.values(this.mTabs).filter(tab => !(tab.id in oldTabs));
    const deselected      = Object.values(oldTabs).filter(tab => !(tab.id in this.mTabs));
    this.set(newlySelected, true, { globalHighlight: false, applying: true });
    this.set(deselected, false, { globalHighlight: false, applying: true });
  }

  set(tabs, selected, options = {}) {
    if (!Array.isArray(tabs))
      tabs = [tabs];
    if (tabs.length == 0)
      return;

    if (options.state)
      options.states = [options.state];
    else if (!options.states)
      options.states = ['selected'];

    const shouldHighlight   = options.states.includes('selected');
    const shouldChangeTitle = options.globalHighlight !== false;

    //console.log(new Error(`setSelection ${options.states.join(',')}=${selected} tabs=${tabs.map(tab => tab.id).join(',')}`));
    if (selected) {
      for (const tab of tabs) {
        if (tab.id in this.mTabs)
          continue;
        this.mTabs[tab.id] = tab;
        if (!options.applying &&
            shouldHighlight &&
            shouldChangeTitle &&
            Permissions.isPermittedTab(tab) &&
            !tab.pinned)
          Permissions.isGranted(Permissions.ALL_URLS).then(() => {
            browser.tabs.executeScript(tab.id, {
              code: `document.title = '✔' + document.title;`
            });
          });
      }
    }
    else {
      for (const tab of tabs) {
        if (!(tab.id in this.mTabs))
          continue;
        delete this.mTabs[tab.id];
        if (!options.applying &&
            shouldHighlight &&
            shouldChangeTitle &&
            Permissions.isPermittedTab(tab) &&
            !tab.pinned)
          Permissions.isGranted(Permissions.ALL_URLS).then(() => {
            browser.tabs.executeScript(tab.id, {
              code: `document.title = document.title.replace(/^✔/, '');`
            });
          });
      }
    }
    if (configs.enableIntegrationWithTST &&
        tabs.length > 0)
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:  selected ? Constants.kTSTAPI_ADD_TAB_STATE : Constants.kTSTAPI_REMOVE_TAB_STATE,
        tabs:  tabs.map(tab => tab.id),
        state: options.states
      }).catch(handleMissingReceiverError);
    if (!options.applying) {
      this.onChange.dispatch(tabs, selected, options);
      this.reserveToSyncSelectedToHighlighted();
    }
  }

  reserveToSyncSelectedToHighlighted() {
    if (this.reserveToSyncSelectedToHighlighted.timer)
      clearTimeout(this.reserveToSyncSelectedToHighlighted.timer);
    this.reserveToSyncSelectedToHighlighted.timer = setTimeout(() => {
      this.reserveToSyncSelectedToHighlighted.timer = null;
      this.syncSelectedToHighlighted();
    }, 100);
  }
  async syncSelectedToHighlighted() {
    if (typeof browser.tabs.highlight != 'function')
      return;

    const tabs        = await this.getAllTabs();
    const selected    = this.getSelectedTabIds();
    const highlighted = tabs.filter(tab => selected.includes(tab.id));

    const highlightedIndices = highlighted.filter(tab => !tab.active).map(tab => tab.index);
    // Active tab must be highlighted.
    // browser.tabs.highlight() doesn't accept "no highlighted" state.
    const activeIndices = tabs.filter(tab => tab.active).map(tab => tab.index);
    // Set active tab highlighted at first, to suppress focus change.
    // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1486050
    browser.tabs.highlight({
      tabs: activeIndices.concat(highlightedIndices)
    });

    setTimeout(() => { // prevent inifinite recursion
      if (!this.reserveToSyncHighlightedToSelected.timer)
        return;
      clearTimeout(this.reserveToSyncHighlightedToSelected.timer);
      this.reserveToSyncHighlightedToSelected.timer = true;
    }, 10);
  }

  reserveToSyncHighlightedToSelected() {
    if (this.reserveToSyncHighlightedToSelected.timer)
      clearTimeout(this.reserveToSyncHighlightedToSelected.timer);
    this.reserveToSyncHighlightedToSelected.timer = setTimeout(() => {
      this.reserveToSyncHighlightedToSelected.timer = null;
      this.syncHighlightedToSelected();
    }, 100);
  }
  async syncHighlightedToSelected() {
    const tabs = await this.getAllTabs();
    if (tabs.filter(tab => tab.highlighted).length == 1) {
      this.clear();
      return;
    }
    const alreadySelected = this.getSelectedTabIds();
    const newlySelected   = tabs.filter(tab => tab.highlighted && !alreadySelected.includes(tab.id));
    const deselected      = tabs.filter(tab => !tab.highlighted && alreadySelected.includes(tab.id));
    this.set(newlySelected, true, { globalHighlight: false });
    this.set(deselected, false, { globalHighlight: false });

    setTimeout(() => { // prevent inifinite recursion
      if (!this.reserveToSyncSelectedToHighlighted.timer)
        return;
      clearTimeout(this.reserveToSyncSelectedToHighlighted.timer);
      this.reserveToSyncSelectedToHighlighted.timer = true;
    }, 10);
  }

  async setAll(selected = true) {
    const tabs = await this.getAllTabs();
    this.set(tabs, selected);
  }

  contains(tabOrTabId) {
    const id = TabIdFixer.fixTabId(typeof tabOrTabId == 'number' ? tabOrTabId : tabOrTabId.id);
    return id in this.mTabs;
  }

  has() {
    return this.count() > 0;
  }

  count() {
    return Object.keys(this.mTabs).length;
  }

  async getAllTabs() {
    const tabs = await browser.tabs.query({ windowId: this.mTargetWindow });
    return tabs.map(TabIdFixer.fixTab);
  }

  async getAPITabSelection(params = {}) {
    const ids        = params.selectedIds || this.getSelectedTabIds();
    const selected   = [];
    const unselected = [];
    const tabs       = params.allTabs || await this.getAllTabs();
    for (const tab of tabs) {
      if (ids.indexOf(tab.id) < 0)
        unselected.push(tab);
      else
        selected.push(tab);
    }
    return { selected, unselected };
  }

  getSelectedTabs() {
    return Object.values(this.mTabs);
  }

  getSelectedTabIds() {
    return Object.keys(this.mTabs).map(id => parseInt(id));
  }

  setLastClickedTab(tab) {
    return this.mLastClickedTab = tab;
  }

  getLastClickedTab() {
    return this.mLastClickedTab;
  }

  async invert() {
    const tabs = await this.getAllTabs();
    const selectedIds = this.getSelectedTabIds();
    const newSelected = [];
    const oldSelected = [];
    for (const tab of tabs) {
      const toBeSelected = selectedIds.indexOf(tab.id) < 0;
      if (toBeSelected)
        newSelected.push(tab);
      else
        oldSelected.push(tab);
    }
    this.set(oldSelected, false);
    this.set(newSelected, true);
  }

  clear(options = {}) {
    const tabs = [];
    for (const id of Object.keys(this.mTabs)) {
      tabs.push(this.mTabs[id]);
    }
    this.set(tabs, false, options);
    this.mTabs = {};
    this.mLastClickedTab = null;
  }

}
