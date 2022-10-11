# History

 - master/HEAD
 - 1.5.1 (2022.10.12)
   * Accept a string which is not placeholders but wrapped with a pair of `%`, as-is instead of reporting "unknown placeholder" error. (regression on 1.5.0)
 - 1.5.0 (2022.10.4)
   * Support `%HTML_SAFE(...)%` (instead of placeholder variations suffixed with `_HTML%`), `%MD_SAFE(...)%` and `%MD_LINK_TITLE_SAFE(...)%` as functional placeholders. You can wrap arbitrary text with them and use as HTML/Markdown-safe text.
   * Support `%ANY(...)%` functional placeholder. It allows you to define formats with auto-fallback for multiple texts.
   * Nested placeholders are completely supported. You can combine `%TST_INDENT(...)%`, `%REPLACE(...)%`, and other functional placeholders in complex from.
   * Text literals wrapped with backquotes are now supported. It will useful for texts including both double quote and single quote.
   * Support separator type items. Items with title like `----` (two or more continuing same symbol characters) are treated as separators in the menu.
 - 1.4.6 (2022.9.12)
   * Copy data in rich text format more certainly.
 - 1.4.5 (2022.3.16)
   * Middle-click on context menu items now works as expected. (Fixed by [FSpark](https://github.com/FSpark), thanks!)
   * Functional placeholders now work as expected for multibyte characters. (Fixed by [FSpark](https://github.com/FSpark), thanks!)
 - 1.4.4 (2021.12.7)
   * Deactivate all notifications after clipboard operations certainly, with the option. It can be a workaround for the [hanging up issue on some environment](https://github.com/piroor/copy-selected-tabs-to-clipboard/pull/28).
 - 1.4.3 (2021.10.1)
   * Add new placeholders `%CONTAINER_NAME%`, `%CONTAINER_NAME_HTMLIFIED%` (and aliases `%CONTAINER_TITLE%` and `%CONTAINER_TITLE_HTMLIFIED`): they will be filled as `<container name>: ` if the tab is non-default container tab. (Suggested and implemented initially by [natask](https://github.com/natask), thanks!)
   * Add new functional placeholders `%CONTAINER_NAME(prefix, suffix)%`, `%CONTAINER_NAME_HTMLIFIED(prefix, suffix)%`: they will be filled as `<prefix><container name><suffix>` if the tab is non-default container tab. For example, `%CONTAINER_NAME("[", "]")%` for a tab with the container "Personal" will become `[Personal]`.
   * Add new placeholders `%CONTAINER_URL%` and `%CONTAINER_URL_HTMLIFIED%` (URL for [Open external links in a container](https://addons.mozilla.org/firefox/addon/open-url-in-container/)). (Suggested and implemented initially by [natask](https://github.com/natask), thanks!)
 - 1.4.2 (2021.5.5)
   * Add ability to copy all tabs when there is no multiselected tab.
 - 1.4.1 (2020.12.2)
   * Add an option to deactivate the desktop notification.
 - 1.4.0 (2020.11.10)
   * Add ability to copy the tree (or descendants) instead of a tab. (require [Tree Style Tab](https://addons.mozilla.org/firefox/addon/tree-style-tab/))
   * Show notification message after successfully copied.
   * Fix wrong behaviors of "All Configs" UI: apply imported configs to options UI immediately and treat decimal values as valid for some numeric options.
 - 1.3.3 (2020.8.8)
   * Fill `%DESCRIPTION%` with OGP description if it is provided.
   * Fill `%AUTHOR%` with the Twitter account name of Twitter Card if it is provided.
   * Add an option to expose errors while getting author, description, and keywords from tab content.
 - 1.3.2 (2020.8.3)
   * Copy tabs as rich text data correctly even if there is no tab permitted to execute scripts.
   * Just ignore placeholders for content fields like `%DESCRIPTION%` for unpermitted tabs.
 - 1.3.1 (2020.7.29)
   * Copy tabs correctly even if there is any placeholder for content fields like `%DESCRIPTION%`.
 - 1.3.0 (2020.6.8)
   * Add a new special placeholder function `%REPLACE(...)%`. See also the [automated test](https://github.com/piroor/copy-selected-tabs-to-clipboard/blob/master/test/test-replacer.js) for its detailed spec.
   * Report errors as copied text.
   * Fallback to plain text copy when failed to copy a rich text.
   * Support rich text copy with `dom.events.asyncClipboard.dataTransfer`=`true`.
 - 1.2.3 (2020.4.28)
   * Handle dismissed semi-modal dialogs correctly.
   * Optimize semi-modal dialogs a little.
 - 1.2.2 (2020.4.25)
   * Improve implementation of semi-modal dialogs. Now it is more stable, more similar to native dialogs, more friendly for dark color scheme, and don't appear in the "Recently Closed Windows" list.
 - 1.2.1 (2020.4.24)
   * Show popup windows correctly on Firefox ESR68. (regression on 1.2.0)
 - 1.2.0 (2020.4.22)
   * Add ability to set an accesskey for each format with the `&` mark in the label.
   * Add ability to set custom keyboard shortcut for each format.
   * Show format choosed dialog as a semi-modal popup window.
 - 1.1.1 (2020.3.19)
   * Don't show top level context menu items when extra context menu items are globally hidden.
   * Show formats correctly even if they are not migrated yet.
   * Restore default formats correctly.
   * Drop support for Firefox 63 and older versions.
 - 1.1.0 (2020.3.18)
   * Introduce "Enabled" checkbox for each format to hide it without deletion.
   * Show menu item directly in the context menu when only one item is available.
 - 1.0.9 (2020.3.6)
   * Show in-content confirmation dialog correctly on lately versions of Firefox.
   * Remove keyboard shorctut customization UI, because Firefox ESR68 has it.
   * Uninitialized options page is now invisible.
 - 1.0.8 (2019.9.18)
   * Correct dynamic update of context menu items on user interactions in the options page.
 - 1.0.7 (2019.8.8)
   * Remove obsolete codes deprecated at Firefox 70.
 - 1.0.6 (2019.5.24)
   * Follow to changes on Tree Style Tab 3.0.12 and Multiple Tab Handler 3.0.7.
   * Add ability to export and import all configurations except keyboard shortcuts. (Options => "Development" => "Debug mode" => "All Configs" => "Import/Export")
 - 1.0.5 (2019.1.3)
   * Add ability co control visibility of context menu items for each: tab context menu and page context menu.
 - 1.0.4 (2018.12.15)
   * Invoke command from Multiple Tab Handler correctly.
 - 1.0.3 (2018.11.30)
   * Show context menu item without multiselection by default.
   * Save removal of "copy to clipboard" formats correctly.
   * Don't show horizontal scrollbar for options.
 - 1.0.2 (2018.11.3)
   * Improve compatibility with Multiple Tab Handler.
 - 1.0.1 (2018.10.31)
   * Improve compatibility with Tree Style Tab.
 - 1.0 (2018.10.30)
   * Separated from [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/).
   * The "zh-CN" locale is added by yfdyh000. Thanks!
