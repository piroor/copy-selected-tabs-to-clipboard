# History

 - master/HEAD
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
