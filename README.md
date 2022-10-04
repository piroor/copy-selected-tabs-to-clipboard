# Copy Selected Tabs to Clipboard

![Build Status](https://github.com/piroor/copy-selected-tabs-to-clipboard/actions/workflows/main.yml/badge.svg?branch=trunk)

Development builds for each commit are available at "Artifacts" of the CI/CD action:
https://github.com/piroor/copy-selected-tabs-to-clipboard/actions?query=workflow%3ACI%2FCD

## Syntax

* Arguments for functional placeholders can be wrapped with quotations: double quote, single quote or back quote. For convenience, put a backslash preceding to a quotation character, if you want to put the quotation character same to the open/close quotations, in a string literal. For example: `'c\'mon'` (apostrophe in a string wrapped with single quotes)
* Quotations to wrap string arguments are optional. Quotations are required only when the string contains special characters like `,` (separator of arguments), `)` (the end of the arguments) and so on. For example, all of them are same: `%TST_INDENT(--)%`, `%TST_INDENT("--")%`, `%TST_INDENT('--')%` and <code>%TST_INDENT(`--`)%</code>

## Example copy formats

|type|format string|
|----|-------------|
|Only URL|`%URL%`|
|Title and URL|`%TITLE%%EOL%%URL%`|
|HTML Link|`<a title="%HTML_SAFE(%TITLE%)%" href="%HTML_SAFE(%URL%)%">%HTML_SAFE(%TITLE%)%</a>`|
|HTML Link (Rich Text)|`%RT%<a title="%HTML_SAFE(%TITLE%)%" href="%HTML_SAFE(%URL%)%">%HTML_SAFE(%TITLE%)%</a>`|
|Markdown Link|`[%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")`|
|Markdown Link List|`%TST_INDENT("  ")%* [%MD_SAFE(%TITLE%)%](%URL% "%MD_LINK_TITLE_SAFE(%TITLE%)%")`|
|URL without query|`%REPLACE("%URL%", "\?.*$", "")%`|
|URL without query except Google|`%REPLACE("%URL%", "^(?!\w+://[^/]*\.google\.[^/]*/.*)\?.*$", "$1")`|
|Org Mode Link List|`*%TST_INDENT(*)% [[%URL%][%TITLE%]]`|
|Firefox container Org Mode| `[[%CONTAINER_URL%][%CONTAINER_NAME("", ": ")%%TITLE%]]`|
|Redmine Issue #|`#%REPLACE("%URL%", "^\w+://.+/([\d+]+)(?:\?[^#]*)?(?:#(?:note-([\d]+))?[^#]*)?$", "$1-$2", "-$", "")%`|

* `%CONTAINER_URL%` will be filled with a URL for [Open external links in a container](https://addons.mozilla.org/firefox/addon/open-url-in-container/), if it is non-default container tab.
