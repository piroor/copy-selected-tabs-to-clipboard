/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
  collectAncestors,
  log,
} from './common.js';
import * as Constants from './constants.js';

export class Context {
  constructor({ mode, tab, multiselectedTabs, modified, withContainer } = {}) {
    this.tab           = tab;
    this.modified      = !!modified;
    this.withContainer = !!withContainer;

    if (mode) {
      log('new context, mode=', mode);
      this.mode = mode;
    }

    if (multiselectedTabs)
      this.multiselectedTabs = multiselectedTabs;

    this.resolved = false;
  }

  async resolve() {
    if (this.resolved)
      return;

    try {
      const [childTabs] = await Promise.all([
        browser.tabs.query({
          windowId:    this.tab.windowId,
          openerTabId: this.tab.id,
          hidden:      false,
        }),
        this.resolveMultiselectedTabs(),
      ]);
      this.childTabs = childTabs.filter(tab => tab.openerTabId && tab.openerTabId != tab.id);
    }
    catch(error) {
      console.log('failed to get child tabs: fallback to all tabs ', error);
      await this.resolveAllTabs();
    }

    this.resolved = true;
  }

  async resolveMultiselectedTabs() {
    if (this.multiselectedTabs)
      return;
    this.multiselectedTabs = this.tab.highlighted ?
      (await browser.tabs.query({
        windowId:    this.tab.windowId,
        highlighted: true,
        hidden:      false,
      })) :
      [this.tab];
  }

  async resolveDescendantTabs() {
    if (this.$descendantTabs)
      return;

    if (!this.resolved)
      await this.resolve();

    try {
      const collectDescendants = async tab => {
        const childTabs = await browser.tabs.query({
          windowId:    tab.windowId,
          openerTabId: tab.id,
          hidden:      false,
        });
        return (await Promise.all(
          childTabs.map(async childTab => [childTab, ...(await collectDescendants(childTab))])
        )).flat().filter(tab => tab.openerTabId && tab.openerTabId != tab.id);
      };
      const [descendantTabs] = await Promise.all([
        collectDescendants(this.tab),
        this.resolveMultiselectedTabs(),
      ]);
      this.descendantTabs = descendantTabs;
      this.descendantIds = new Set(descendantTabs.map(tab => tab.id));
    }
    catch(error) {
      console.log('failed to get descendant tabs: ', error);
    }
  }

  async resolveAllTabs() {
    if (this.allTabs)
      return;

    if (!this.resolved)
      await this.resolve();

    this.allTabs = await browser.tabs.query({
      windowId: this.tab.windowId,
      hidden:   false,
    }).catch(_error => []);
    if (!this.multiselectedTabs)
      this.multiselectedTabs = this.tab.highlighted ?
        this.allTabs.filter(tab => tab.highlighted) :
        [this.tab];
  }

  set mode(value) {
    return this.$mode = value;
  }
  get mode() {
    if ('$mode' in this)
      return this.$mode;

    log('resolving mode, isTreeParent=', this.isTreeParent, ', modified=', this.modified);

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

    return this.$isTreeParent = (this.childTabs ? this.childTabs.length : this.descendantIds.size) > 0;
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
      (this.isTreeParent &&
       [...(this.shouldCopyOnlyDescendants ? [] : [this.tab]), ...(this.childTabs || this.descendantIds)]) ||
      this.multiselectedTabs
    ).length > 1;
  }

  set descendantIds(value) {
    return this.$descendantIds = value;
  }
  get descendantIds() {
    if ('$descendantIds' in this)
      return this.$descendantIds;

    if (!this.allTabs)
      throw new Error('you must resolve tabs with resolveAllTabs() at first.');

    const ancestorsOf = collectAncestors(this.allTabs);
    const descendantIds = new Set(
      Object.entries(ancestorsOf)
        .filter(([_id, ancestors]) => ancestors.includes(this.tab.id))
        .map(([id, _ancestors]) => parseInt(id))
    );
    return this.$descendantTabs = this.allTabs.filter(tab => descendantIds.has(tab.id));
    return this.$descendantIds = descendantIds;
  }

  set descendantTabs(value) {
    return this.$descendantTabs = value;
  }
  get descendantTabs() {
    if ('$descendantTabs' in this)
      return this.$descendantTabs;

    throw new Error('you must resolve tabs with resolve() and resolveAllTabs() at first.');
  }

  async getTabsToCopy() {
    if (this.$tabsToCopy)
      return this.$tabsToCopy;

    await this.resolveDescendantTabs();

    if (this.shouldCopyAll)
      await this.resolveAllTabs();

    log('getTabsToCopy mode=', this.mode, ', shouldCopyAll=', this.shouldCopyAll);

    this.$tabsToCopy = this.multiselectedTabs.length > 1 ?
      this.multiselectedTabs :
      this.shouldCopyAll ?
        this.allTabs :
        this.mode == Constants.kCOPY_INDIVIDUAL_TAB ?
          [this.tab] :
          this.shouldCopyOnlyDescendants ?
            this.descendantTabs :
            [this.tab, ...this.descendantTabs];

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
