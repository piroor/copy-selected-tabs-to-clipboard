/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export class ReplacerError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function processAll(input, filter) {
  let output = '';
  while (true) {
    const index = input.search(/%REPLACE\(/i);
    if (index < 0) {
      output += input;
      break;
    }

    output += input.substring(0, index);
    const replacer = input.substring(index, index + 9);
    input = input.substring(index + 9);

    let pendingChar  = '';
    let lastToken    = '';
    let inSingleQuoteString = false;
    let inDoubleQuoteString = false;
    let count = 0;
    let args = [];
    let rawArgs = '';
    parse:
    for (const character of input) {
      switch (character) {
        case '%':
          if (!inSingleQuoteString &&
              !inDoubleQuoteString &&
              pendingChar == ')') {
            if (args.length > 0 || lastToken != '')
              args.push(lastToken);
            output += processOne(args, filter);
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
            throw new ReplacerError(`Invalid character "${character}" after "${replacer}${rawArgs}", you may forgot to wrap any argument with quotations`);
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
      throw new ReplacerError(`Untermited replacer "${replacer}${rawArgs}", you may forgot to put close-quote for any argument`);
    }
  }
  return output;
}

function processOne(args, filter) {
  if (args.length == 0)
    throw new ReplacerError(`Missing argument: Replacer must take one base text and one or more matcher/replace-text pairs`);
  if (args.length % 2 == 0)
    throw new ReplacerError(`Missing replace text for the last matcher: Replacer must take one base text and one or more matcher/replace-text pairs`);
  if (args.length < 2)
    throw new ReplacerError(`Missing matcher/replace-text pair: Replacer must take one base text and one or more matcher/replace-text pairs`);

  let filled = args.shift();
  if (typeof filter == 'function')
    filled = filter(filled, ...args);
  for (let i = 0, maxi = args.length; i < maxi; i += 2) {
    filled = filled.replace(new RegExp(args[i], 'i'), args[i + 1]);
  }
  return filled;
}
