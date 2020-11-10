# Copy Selected Tabs to Clipboard

[![Build Status](https://travis-ci.org/piroor/copy-selected-tabs-to-clipboard.svg?branch=trunk)](https://travis-ci.org/piroor/copy-selected-tabs-to-clipboard)

Development builds for each commit are available at "Artifacts" of the CI/CD action:
https://github.com/piroor/copy-selected-tabs-to-clipboard/actions?query=workflow%3ACI%2FCD

## Examples copy formats

|type|format string|
|----|-------------|
|Only URL|`%URL%`|
|Title and URL|`%TITLE%%EOL%%URL%`|
|HTML Link|`<a title="%TITLE_HTML%" href="%URL_HTML%">%TITLE_HTML%</a>`|
|HTML Link (Rich Text)|`%RT%<a title="%TITLE_HTML%" href="%URL_HTML%">%TITLE_HTML%</a>`|
|Markdown Link|`[%TITLE%](%URL% "%TITLE%")`|
|Markdown Link List|`%TST_INDENT(  )%* [%TITLE%](%URL% "%TITLE%")`|
|URL without query|`%REPLACE("%URL%", "\?.*$", "")%`|
|URL without query except Google|`%REPLACE("%URL%", "^(?!\w+://[^/]*\.google\.[^/]*/.*)\?.*$", "$1")`|

