# Copy Selected Tabs to Clipboard

![Build Status](https://github.com/piroor/copy-selected-tabs-to-clipboard/actions/workflows/main.yml/badge.svg?branch=trunk)

* [Signed package on AMO](https://addons.mozilla.org/firefox/addon/copy-selected-tabs-to-clipboar/)
* [Development builds for each commit are available at "Artifacts" of the CI/CD action](https://github.com/piroor/copy-selected-tabs-to-clipboard/actions?query=workflow%3ACI%2FCD)


## Syntax

* Arguments for functional placeholders can be wrapped with quotations: double quote (`"`), single quote (`'`) or back quote (`` ` ``). For convenience, put a backslash preceding to a quotation character, if you want to put the quotation character same to the open/close quotations, in a string literal. For example: `'c\'mon'` (apostrophe in a string wrapped with single quotes)
* Quotations to wrap string arguments are optional. Quotations are required only when the string contains special characters like `,` (separator of arguments), `)` (the end of the arguments) and so on. For example, all of them are same: `%TREE_INDENT(--)%`, `%TREE_INDENT("--")%`, `%TREE_INDENT('--')%` and ``%TREE_INDENT(`--`)%``

## Example copy formats

|type|format string|
|----|-------------|
|Only URL|`%URL%`|
|Title and URL|`%TITLE%%EOL%%URL%`|
|HTML Link|`<a title="%HTML_SAFE(%TITLE%)%" href="%HTML_SAFE(%URL%)%">%HTML_SAFE(%TITLE%)%</a>`|
|HTML Link (Rich Text)|`%RT%<a title="%HTML_SAFE(%TITLE%)%" href="%HTML_SAFE(%URL%)%">%HTML_SAFE(%TITLE%)%</a>`|
|Markdown Link|`[%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")`|
|Markdown Link List|`%TREE_INDENT("  ")%* [%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")`|
|URL without query|`%REPLACE("%URL%", "\?.*$", "")%`|
|URL without query except Google|`%REPLACE("%URL%", "^(?!\w+://[^/]*\.google\.[^/]*/.*)\?.*$", "$1")`|
|Org Mode Link List|`*%TREE_INDENT(*)% [[%URL%][%TITLE%]]`|
|Firefox container Org Mode| `[[%CONTAINER_URL%][%CONTAINER_NAME("", ": ")%%TITLE%]]`|
|Redmine Issue #|`#%REPLACE("%URL%", "^\w+://.+/([\d+]+)(?:\?[^#]*)?(?:#(?:note-([\d]+))?[^#]*)?$", "$1-$2", "-$", "")%`|

* `%CONTAINER_URL%` will be filled with a URL for [Open external links in a container](https://addons.mozilla.org/firefox/addon/open-url-in-container/), if it is non-default container tab.

## Privacy Policy

This software does not collect any privacy data automatically, but this includes ability to synchronize options across multiple devices automatically via Firefox Sync.
Any data you input to options may be sent to Mozilla's Sync server, if you configure Firefox to activate Firefox Sync.

このソフトウェアはいかなるプライバシー情報も自動的に収集しませんが、Firefox Syncを介して自動的に設定情報をデバイス間で同期する機能を含みます。
Firefox Syncを有効化している場合、設定画面に入力されたデータは、Mozillaが運用するSyncサーバーに送信される場合があります。
