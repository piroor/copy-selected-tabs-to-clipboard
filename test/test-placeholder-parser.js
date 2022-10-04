/*
 license: The MIT License, Copyright (c) 2022 YUKI "Piro" Hiroshi
*/
'use strict';

import * as Parser from '../common/placeholder-parser.js';

import { assert } from 'tiny-esm-test-runner';
const { is /*, ok, ng*/ } = assert;

export function testProcessorCalls() {
  const input = `
    %unquoted(1st, 2nd, 3rd)%
    %single-quoted('1st', '2nd', '3rd')%
    %double-quoted("1st", "2nd", "3rd")%
    %multiple-parens(1st)(2nd)(3rd)%
    %mixed-quoted(1"s"'t', '2'n"d", "3"'r'd)%
    %whitespace(   )%
    %escaped-terminator\\%%
    %escaped-open-paren\\(%
    %escaped-close-paren(\\))%
    %escaped-close-quotations("\\"", '\\'')%
    %no-need-to-escape-character(\\a, "\\a\\'", '\\a\\"')%
    %escaped-arg("^\\w+//[^#]+/([\\d]+)+$")%
    %"quoted-name()%"%
    %parent(%1st-child%, "%2nd-child%", '%3rd-child(a, b, c)%')%
    %grand-parent("%parent2(%1st-child2%, "%2nd-child2%", '%3rd-child2(a, b, c)%')%")%
  `;
  const expectedCalls = [
    ['unquoted', '1st, 2nd, 3rd', '1st', '2nd', '3rd'],
    ['single-quoted', "'1st', '2nd', '3rd'", '1st', '2nd', '3rd'],
    ['double-quoted', '"1st", "2nd", "3rd"', '1st', '2nd', '3rd'],
    ['multiple-parens', '1st, 2nd, 3rd', '1st', '2nd', '3rd'],
    ['mixed-quoted', `1"s"'t', '2'n"d", "3"'r'd`, '1st', '2nd', '3rd'],
    ['whitespace', '   '],
    ['escaped-terminator%', ''],
    ['escaped-open-paren(', ''],
    ['escaped-close-paren', ')', ')'],
    ['escaped-close-quotations', `"\\"", '\\''`, '"', "'"],
    ['no-need-to-escape-character', `\\a, "\\a\\'", '\\a\\"'`, '\\a', '\\a\\\'', '\\a\\"'],
    ['escaped-arg', '"^\\w+//[^#]+/([\\d]+)+$"', '^\\w+//[^#]+/([\\d]+)+$'],
    ['quoted-name()%', ''],

    ['1st-child', ''],
    ['2nd-child', ''],
    ['3rd-child', 'a, b, c', 'a', 'b', 'c'],
    [
      'parent', `%1st-child%, "%2nd-child%", '%3rd-child(a, b, c)%'`,
      '%1st-child%', '%2nd-child%', '%3rd-child("a", "b", "c")%',
    ],

    ['1st-child2', ''],
    ['2nd-child2', ''],
    ['3rd-child2', 'a, b, c', 'a', 'b', 'c'],
    [
      'parent2', `%1st-child2%, %2nd-child2%, '%3rd-child2(a, b, c)%'`,
      '%1st-child2%', '%2nd-child2%', '%3rd-child2("a", "b", "c")%',
    ],
    [
      'grand-parent', `"%parent2(%1st-child2%, "%2nd-child2%", '%3rd-child2(a, b, c)%')%"`,
      '%parent2("%1st-child2%", "%2nd-child2%", "%3rd-child2(\\"a\\", \\"b\\", \\"c\\")%")%',
    ],
  ];
  Parser.process(input, (name, rawArgs, ...args) => {
    //console.log(name, { rawArgs, args });
    is(expectedCalls.shift(), [name, rawArgs, ...args], JSON.stringify({ name, rawArgs, args }));
    const argsPart = args.length == 0 ? '' : `(${args.map(arg => JSON.stringify(arg)).join(', ')})`;
    return `%${name}${argsPart}%`;
  });
}
