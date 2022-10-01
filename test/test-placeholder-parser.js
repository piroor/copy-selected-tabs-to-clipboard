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
    %mixed-quoted(1"s"'t', '2'n"d", "3"'r'd)%
    %escaped-terminator\\%%
    %escaped-open-paren\\(%
    %escaped-close-paren(\\))%
    %"quoted-name()%"%
    %parent(%1st-child%, "%2nd-child%", '%3rd-child(a, b, c)%')%
    %grand-parent("%parent(%1st-child%, "%2nd-child%", '%3rd-child(a, b, c)%')%")%
  `;
  const expectedCalls = [
    ['unquoted', '1st', '2nd', '3rd'],
    ['single-quoted', '1st', '2nd', '3rd'],
    ['double-quoted', '1st', '2nd', '3rd'],
    ['mixed-quoted', '1st', '2nd', '3rd'],
    ['escaped-terminator%'],
    ['escaped-open-paren('],
    ['escaped-close-paren', ')'],
    ['quoted-name()%'],
    ['1st-child'],
    ['2nd-child'],
    ['3rd-child', 'a', 'b', 'c'],
    ['parent', '%1st-child()%', '%2nd-child()%', '%3rd-child("a", "b", "c")%'],
    ['1st-child'],
    ['2nd-child'],
    ['3rd-child', 'a', 'b', 'c'],
    ['parent', '%1st-child()%', '%2nd-child()%', '%3rd-child("a", "b", "c")%'],
    ['grand-parent', '%parent("%1st-child()%", "%2nd-child()%", "%3rd-child(\\"a\\", \\"b\\", \\"c\\")%")%'],
  ];
  Parser.process(input, (name, ...args) => {
    is(expectedCalls.shift(), [name, ...args]);
    return `%${name}(${args.map(arg => JSON.stringify(arg)).join(', ')})%`;
  });
}
