/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export class FunctionalPlaceHolderError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function processAll({ name, filter, input }) {
  let output = '';
  const startMatcher = new RegExp(`%${name}\\(`, 'i');
  const prefixSize = name.length + 2;
  while (true) {
    const index = input.search(startMatcher);
    if (index < 0) {
      output += input;
      break;
    }

    output += input.substring(0, index);
    const prefix = input.substring(index, index + prefixSize);
    input = input.substring(index + prefixSize);

    let pendingChar  = '';
    let lastToken    = '';
    let inSingleQuoteString = false;
    let inDoubleQuoteString = false;
    let count = 0;
    let args = [];
    let rawArgs = '';
    parse:
    for (const character of input) {
      //console.log({character, lastToken, pendingChar, inSingleQuoteString, inDoubleQuoteString, count});
      switch (character) {
        case '%':
          if (!inSingleQuoteString &&
              !inDoubleQuoteString &&
              pendingChar == ')') {
            if (args.length > 0 || lastToken != '')
              args.push(lastToken);
            output += filter(...args);
            input = input.substring(count + 1);
            lastToken    = '';
            args         = [];
            rawArgs      = '';
            break parse;
          }
          lastToken += pendingChar + character;
          rawArgs += pendingChar + character;
          pendingChar = '';
          break;

        case ')':
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + character;
            rawArgs += pendingChar + character;
            pendingChar = '';
          }
          else {
            lastToken += pendingChar;
            rawArgs += pendingChar;
            pendingChar = character;
          }
          break;

        case '\\':
          lastToken += pendingChar;
          rawArgs += pendingChar;
          pendingChar = character;
          break;

        case ',':
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + character;
            rawArgs += pendingChar + character;
            pendingChar = '';
          }
          else {
            args.push(lastToken + pendingChar);
            rawArgs += pendingChar + character;
            pendingChar = '';
            lastToken = '';
          }
          break;

        case '"':
          if (inDoubleQuoteString) {
            if (pendingChar == '\\') {
              pendingChar = '';
              lastToken += character;
            }
            else {
              inDoubleQuoteString = false;
              lastToken += pendingChar;
            }
          }
          else if (!inSingleQuoteString) {
            inDoubleQuoteString = true;
          }
          else {
            lastToken += pendingChar + character;
          }
          rawArgs += pendingChar + character;
          pendingChar = '';
          break;

        case "'":
          if (inSingleQuoteString) {
            if (pendingChar == '\\') {
              pendingChar = '';
              lastToken += character;
            }
            else {
              inSingleQuoteString = false;
              lastToken += pendingChar;
            }
          }
          else if (!inDoubleQuoteString) {
            inSingleQuoteString = true;
          }
          else {
            lastToken += pendingChar + character;
          }
          rawArgs += pendingChar + character;
          pendingChar = '';
          break;

        default:
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + character;
            rawArgs += pendingChar + character;
            pendingChar = '';
          }
          else if (!/\s/.test(character)) {
            rawArgs += pendingChar;
            throw new FunctionalPlaceHolderError(`Invalid character "${character}" after "${prefix}${rawArgs}", you may forgot to wrap any argument with quotations`);
          }
          else {
            rawArgs += pendingChar + character;
            pendingChar = '';
          }
          break;
      }
      count++;
    }
    if (rawArgs != '') {
      throw new FunctionalPlaceHolderError(`Untermited functional placeholder "${prefix}${rawArgs}", you may forgot to put close-quote for any argument`);
    }
  }
  return output;
}
