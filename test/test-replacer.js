/*
 license: The MIT License, Copyright (c) 2020 YUKI "Piro" Hiroshi
*/
'use strict';

/*
This is an automated test for the `%REPLACE(...)%` placeholder function.
It accepts one base text and one or more pairs of matcher/replaced-text,
for example:

  %REPLACE("base text", "^ba", "ca", "se\b", "ke")%
  => This will return "cake text".

All arguments must be defined as strings wrapped with quotations (single or
double), and delimited with ",". Any whitespace outside strings is ignored.

The matcher part is parsed as a full-featured JavaScript regular expression,
case-insensitive and not global match. Available syntax depends on the runtime
JavaScript engine.

See also:
https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_Expressions/Cheatsheet
*/

import * as Replacer from '../common/replacer.js';

import { assert } from 'tiny-esm-test-runner';
const { is, ok, ng } = assert;

function assertReplaced(args, expected) {
  const replaced = Replacer.replace(args);
  is(expected, replaced);
}

export function testReplaced() {
  assertReplaced(
    ['input text', 'input', 'output'],
    'output text'
  );
  assertReplaced( // should ignore cases
    ['input text', 'INPUT', 'output'],
    'output text'
  );
  assertReplaced( // should not global match
    ['input text in replacer', 'in[^ ]*', 'output'],
    'output text in replacer'
  );
  assertReplaced( // should accept multiple replace pairs
    ['input text in replacer', 'in[^ ]*', 'output', 'in[^ ]*', 'of'],
    'output text of replacer'
  );
  assertReplaced( // meta character
    ['base text', '\\bba', 'ca', 'se\\b', 'ke'],
    'cake text'
  );
  assertReplaced( // remove query part
    ['http://example.com/?query', '\\?.*$', ''],
    'http://example.com/'
  );

  // remove query part except google and yahoo
  const matcher = '^((?!\\w+://([^/]*\\.)?(google\\.com|duckduckgo\\.com)/.*).*)\\?.*$';
  assertReplaced(
    ['http://example.com/?query', matcher, '$1'],
    'http://example.com/'
  );
  assertReplaced( // remove query part except google and yahoo
    ['https://www.google.com/search?query', matcher, '$1'],
    'https://www.google.com/search?query'
  );
  assertReplaced( // remove query part except google and yahoo
    ['https://duckduckgo.com/search?query', matcher, '$1'],
    'https://duckduckgo.com/search?query'
  );
}

function assertFailed(args, expectedError) {
  try {
    Replacer.replace(args);
    ng('must be failed');
  }
  catch(error) {
    ok(error instanceof Replacer.ReplacerError, error);
    is(expectedError, error.message);
  }
}

export function testErrors() {
  assertFailed(
    [],
    'Missing argument: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
  assertFailed(
    ['base'],
    'Missing matcher/replace-text pair: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
  assertFailed(
    ['base', '1st', '2nd', '3rd'],
    'Missing replace text for the last matcher: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
}
