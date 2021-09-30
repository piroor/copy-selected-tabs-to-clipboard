/*
 license: The MIT License, Copyright (c) 2020-2021 YUKI "Piro" Hiroshi
*/
'use strict';

import * as FunctionalPlaceHolder from '../common/functional-placeholder.js';

import { assert } from 'tiny-esm-test-runner';
const { is, ok, ng } = assert;

function assertSuccess(input, ...expectedArgs) {
  const expectedFilled = expectedArgs.pop();
  const filled = FunctionalPlaceHolder.processAll(input, {
    func: (...args) => {
      is(expectedArgs.shift(), args);
      return 'REPLACED';
    },
  });
  is(expectedFilled, filled);
}

export function testDoubleQuote() {
  assertSuccess(
    'prefix %FUNC("1st", "2nd", "3rd")% suffix',
    ['1st', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should ignore whitespaced outside quotations
    'prefix %FUNC(  "  1st  "  ,  "  2nd  "  ,  "  3rd  "  )% suffix',
    ['  1st  ', '  2nd  ', '  3rd  '],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should ignore argument delimiters in quotations
    'prefix %FUNC("1,s,t", "2,n,d", "3,r,d")% suffix',
    ['1,s,t', '2,n,d', '3,r,d'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should concatenate sequential multiple quotations
    'prefix %FUNC("1st"" text", "2nd ""arg", "3rd"   " arg")% suffix',
    ['1st text', '2nd arg', '3rd arg'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should be safe for the end mark in quotations
    'prefix %FUNC("1st)%", "2nd", "3rd")% suffix',
    ['1st)%', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should accept escaped close quote
    'prefix %FUNC("1st\\"", "\\"2nd", "3rd\\"")% suffix',
    ['1st"', '"2nd', '3rd"'],
    'prefix REPLACED suffix'
  );
}

export function testSingleQuote() {
  assertSuccess(
    "prefix %FUNC('1st', '2nd', '3rd')% suffix",
    ['1st', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should ignore whitespaced outside quotations
    "prefix %FUNC(  '  1st  '  ,  '  2nd  '  ,  '  3rd  '  )% suffix",
    ['  1st  ', '  2nd  ', '  3rd  '],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should ignore argument delimiters in quotations
    "prefix %FUNC('1,s,t', '2,n,d', '3,r,d')% suffix",
    ['1,s,t', '2,n,d', '3,r,d'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should concatenate sequential multiple quotations
    "prefix %FUNC('1st'' text', '2nd ''arg', '3rd'   ' arg')% suffix",
    ['1st text', '2nd arg', '3rd arg'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should be safe for the end mark in quotations
    "prefix %FUNC('1st)%', '2nd', '3rd')% suffix",
    ['1st)%', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should accept escaped close quote
    "prefix %FUNC('1st\\'', '\\'2nd', '3rd\\'')% suffix",
    ["1st'", "'2nd", "3rd'"],
    "prefix REPLACED suffix"
  );
}

export function testMixedQuote() {
  assertSuccess(
    "prefix %FUNC('1st', \"2nd\", '3rd')% suffix",
    ['1st', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess(
    "prefix %FUNC('1st '\"text\", \"2nd\"' arg', '3rd '    \"arg\")% suffix",
    ['1st text', '2nd arg', '3rd arg'],
    'prefix REPLACED suffix'
  );
  assertSuccess(
    "prefix %FUNC('\"1st\"', \"'2nd'\", '\"3rd\"')% suffix",
    ['"1st"', "'2nd'", '"3rd"'],
    'prefix REPLACED suffix'
  );
}

export function testReplaced() {
  assertSuccess(
    'prefix %FUNC("input text", "input", "output")% suffix',
    ['input text', 'input', 'output'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should ignore cases
    'prefix %FUNC("input text", "INPUT", "output")% suffix',
    ['input text', 'INPUT', 'output'],
    'prefix REPLACED suffix'
  );

  assertSuccess( // should not global match
    'prefix %FUNC("input text in replacer", "in[^ ]*", "output")% suffix',
    ['input text in replacer', 'in[^ ]*', 'output'],
    'prefix REPLACED suffix'
  );

  assertSuccess( // should accept multiple replace pairs
    'prefix %FUNC("input text in replacer", "in[^ ]*", "output", "in[^ ]*", "of")% suffix',
    ['input text in replacer', 'in[^ ]*', 'output', 'in[^ ]*', 'of'],
    'prefix REPLACED suffix'
  );
  assertSuccess( // should accept multiple replacers
    'prefix %FUNC("input text", "input", "output")% middle %FUNC("second input text", "input", "output")% suffix',
    ['input text', 'input', 'output'],
    ['second input text', 'input', 'output'],
    'prefix REPLACED middle REPLACED suffix'
  );
}

export function testIgnoreCases() {
  assertSuccess(
    'prefix %func("1st", "2nd", "3rd")% suffix',
    ['1st', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
  assertSuccess(
    'prefix %fUnC("1st", "2nd", "3rd")% suffix',
    ['1st', '2nd', '3rd'],
    'prefix REPLACED suffix'
  );
}


function assertFailed(input, expectedError) {
  try {
    FunctionalPlaceHolder.processAll(input, {
      func: () => {},
    });
    ng('must be failed');
  }
  catch(error) {
    ok(error instanceof FunctionalPlaceHolder.FunctionalPlaceHolderError);
    is(expectedError, error.message);
  }
}

export function testErrors() {
  assertFailed(
    'prefix %FUNC("1st", "unterminated)%',
    'Untermited functional placeholder "%FUNC("1st", "unterminated)%", you may forgot to put close-quote for any argument'
  );
  assertFailed(
    'prefix %FUNC("1st", unquoted)%',
    'Invalid character "u" after "%FUNC("1st", ", you may forgot to wrap any argument with quotations'
  );
}

export function testMultiplePlaceholders() {
  const input = 'prefix %A()% middle %B()% suffix';
  const expected = 'prefix A middle B suffix';
  const filled = FunctionalPlaceHolder.processAll(input, {
    a: () => 'A',
    b: () => 'B',
  });
  is(expected, filled);
}
