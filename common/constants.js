/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export const kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO = 'multipletab:pull-active-context-menu-info';
export const kCOMMAND_SELECTION_MENU_ITEM_CLICK     = 'multipletab:selection-menu-item-click';
export const kCOMMAND_UNREGISTER_FROM_TST           = 'multipletab:unregister-from-tst';
export const kCOMMAND_NOTIFY_PANEL_SHOWN            = 'multipletab:notify-panel-shown';
export const kCOMMAND_NOTIFY_PERMISSIONS_GRANTED    = 'multipletab:notify-permissions-granted';
export const kCOMMAND_REQUEST_CONNECT_PREFIX        = 'multipletab:request-connect-from:';


export const kMTHAPI_READY                       = 'ready';
export const kMTHAPI_GET_TAB_SELECTION           = 'get-tab-selection';
export const kMTHAPI_SET_TAB_SELECTION           = 'set-tab-selection';
export const kMTHAPI_CLEAR_TAB_SELECTION         = 'clear-tab-selection';
export const kMTHAPI_ADD_SELECTED_TAB_COMMAND    = 'add-selected-tab-command';
export const kMTHAPI_REMOVE_SELECTED_TAB_COMMAND = 'remove-selected-tab-command';
export const kMTHAPI_INVOKE_SELECTED_TAB_COMMAND = 'selected-tab-command';

export const kNOTIFICATION_DEFAULT_ICON = '/resources/24x24-light.svg';
export const kPOPUP_URL = '/panel/panel.html';


export const kTST_ID = 'treestyletab@piro.sakura.ne.jp';

export const kTSTAPI_REGISTER_SELF           = 'register-self';
export const kTSTAPI_UNREGISTER_SELF         = 'unregister-self';
export const kTSTAPI_PING                    = 'ping';
export const kTSTAPI_NOTIFY_READY            = 'ready';
export const kTSTAPI_NOTIFY_TAB_CLICKED      = 'tab-clicked'; // for backward compatibility
export const kTSTAPI_NOTIFY_TAB_MOUSEDOWN    = 'tab-mousedown';
export const kTSTAPI_NOTIFY_TAB_MOUSEUP      = 'tab-mouseup';
export const kTSTAPI_NOTIFY_TABBAR_CLICKED   = 'tabbar-clicked'; // for backward compatibility
export const kTSTAPI_NOTIFY_TABBAR_MOUSEDOWN = 'tabbar-mousedown';
export const kTSTAPI_NOTIFY_TABBAR_MOUSEUP   = 'tabbar-mouseup';
export const kTSTAPI_NOTIFY_TAB_DRAGREADY    = 'tab-dragready';
export const kTSTAPI_NOTIFY_TAB_DRAGCANCEL   = 'tab-dragcancel';
export const kTSTAPI_NOTIFY_TAB_DRAGSTART    = 'tab-dragstart';
export const kTSTAPI_NOTIFY_TAB_DRAGENTER    = 'tab-dragenter';
export const kTSTAPI_NOTIFY_TAB_DRAGEXIT     = 'tab-dragexit';
export const kTSTAPI_NOTIFY_TAB_DRAGEND      = 'tab-dragend';
export const kTSTAPI_GROUP_TABS              = 'group-tabs';
export const kTSTAPI_ADD_TAB_STATE           = 'add-tab-state';
export const kTSTAPI_REMOVE_TAB_STATE        = 'remove-tab-state';
export const kTSTAPI_GET_TREE                = 'get-tree';
export const kTSTAPI_GET_TREE_STRUCTURE      = 'get-tree-structure';
export const kTSTAPI_SET_TREE_STRUCTURE      = 'set-tree-structure';
export const kTSTAPI_BLOCK_GROUPING          = 'block-grouping';
export const kTSTAPI_UNBLOCK_GROUPING        = 'unblock-grouping';
export const kTSTAPI_CONTEXT_MENU_OPEN       = 'fake-contextMenu-open';
export const kTSTAPI_CONTEXT_MENU_CREATE     = 'fake-contextMenu-create';
export const kTSTAPI_CONTEXT_MENU_UPDATE     = 'fake-contextMenu-update';
export const kTSTAPI_CONTEXT_MENU_REMOVE     = 'fake-contextMenu-remove';
export const kTSTAPI_CONTEXT_MENU_REMOVE_ALL = 'fake-contextMenu-remove-all';
export const kTSTAPI_CONTEXT_MENU_CLICK      = 'fake-contextMenu-click';
