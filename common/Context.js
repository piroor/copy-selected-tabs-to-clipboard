/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
} from './common.js';
import * as Constants from './constants.js';

export class Context {
  constructor({ mode, tab, multiselectedTabs, modified, withContainer } = {}) {
    this.tab           = tab;
    this.modified      = !!modified;
    this.withContainer = !!withContainer;

    if (mode)
      this.mode = mode;

    if (multiselectedTabs)
      this.multiselectedTabs = multiselectedTabs;

    this.resolved = false;
  }

  async resolve() {
    if (this.resolved)
      return;

    this.allTabs = await browser.tabs.query({
      windowId: this.tab.windowId,
      hidden:   false,
    }).catch(_error => []);
    if (!this.multiselectedTabs)
      this.multiselectedTabs = this.tab.highlighted ?
        this.allTabs.filter(tab => tab.highlighted) :
        [this.tab];

    this.resolved = true;
  }

  set mode(value) {
    return this.$mode = value;
  }
  get mode() {
    if ('$mode' in this)
      return this.$mode;

    return this.$mode = this.isTreeParent ?
      (this.modified ?
        configs.modeForNoSelectionTreeModified :
        configs.modeForNoSelectionTree) :
      (this.modified ?
        configs.modeForNoSelectionModified :
        configs.modeForNoSelection);
  }

  get isTreeParent() {
    if ('$isTreeParent' in this)
      return this.$isTreeParent;

    return this.$isTreeParent = this.descendantIds.size > 0;
  }

  get shouldCopyOnlyDescendants() {
    if ('$shouldCopyOnlyDescendants' in this)
      return this.$shouldCopyOnlyDescendants;

    return this.$shouldCopyOnlyDescendants = (
      this.isTreeParent &&
      this.mode == Constants.kCOPY_TREE_DESCENDANTS
    );
  }

  get shouldCopyAll() {
    return this.mode == Constants.kCOPY_ALL;
  }

  get shouldCopyMultipleTabs() {
    if ('$shouldCopyMultipleTabs' in this)
      return this.$shouldCopyMultipleTabs;

    return this.$shouldCopyMultipleTabs = (
      (this.isTreeParentisTree &&
       [...(this.shouldCopyOnlyDescendants ? [] : [this.tab]), ...this.descendantIds]) ||
      this.multiselectedTabs
    ).length > 1;
  }

  get descendantIds() {
    if ('$descendantIds' in this)
      return this.$descendantIds;

    if (!this.allTabs)
      throw new Error('you must resolve tabs with resolve() at first.');

    const ancestorsOf = {};
    for (const tab of this.allTabs) {
      // Note: apparently Sidebery sets the openerTabId to the tab's own id
      // when it is a "root" tab.
      if (tab.openerTabId !== undefined && tab.openerTabId !== tab.id) {
        ancestorsOf[tab.id] = [tab.openerTabId].concat(ancestorsOf[tab.openerTabId] || []);
      }
      else {
        ancestorsOf[tab.id] = [];
      }
    }
    const descendantIds = new Set(
      Object.entries(ancestorsOf)
        .filter(([_id, ancestors]) => ancestors.includes(this.tab.id))
        .map(([id, _ancestors]) => parseInt(id))
    );
    return this.$descendantIds = descendantIds;
  }

  get descendantTabs() {
    if ('$descendantTabs' in this)
      return this.$descendantTabs;

    return this.$descendantTabs = this.allTabs.filter(tab => this.descendantIds.has(tab.id));
  }

  async getTabsToCopy() {
    if (this.$tabsToCopy)
      return this.$tabsToCopy;

    await this.resolve();

    this.$tabsToCopy = this.multiselectedTabs.length > 1 ?
      this.multiselectedTabs :
      this.shouldCopyAll ?
        this.allTabs :
        this.mode == Constants.kCOPY_INDIVIDUAL_TAB ?
          [this.tab] :
          (this.isTreeParent &&
           this.allTabs.filter(tab => this.descendantIds.has(tab.id) || (!this.shouldCopyOnlyDescendants && tab.id == this.tab.id)));

    if (this.withContainer) {
      const cookieStoreIds = [...new Set(this.$tabsToCopy.map(tab => tab.cookieStoreId))];
      this.$containerNameById = new Map();
      await Promise.all(
        cookieStoreIds.map(cookieStoreId =>
          browser.contextualIdentities.get(cookieStoreId).catch(_error => null).then(container => {
            if (container)
              this.$containerNameById.set(cookieStoreId, container && container.name || cookieStoreId);
          })
        )
      );
      for (const tab of this.$tabsToCopy) {
        tab.container = this.$containerNameById.get(tab.cookieStoreId);
      }
    }
    return this.$tabsToCopy;
  }
}
