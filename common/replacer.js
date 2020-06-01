/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

class ReplacerSyntaxError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function processAll(input, filler, fillerParams) {
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
    let lastRawToken = '';
    let inSingleQuoteString = false;
    let inDoubleQuoteString = false;
    let count = 0;
    let args = [];
    let rawArgs = [];
    parse:
    for (const c of input) {
      switch (c) {
        case '%':
          if (!inSingleQuoteString &&
              !inDoubleQuoteString &&
              pendingChar == ')') {
            if (args.length > 0)
              args.push(lastToken);
            output += processOne(args, filler, fillerParams);
            input = input.substring(count + 1);
            lastToken    = '';
            lastRawToken = '';
            args         = [];
            rawArgs      = [];
            break parse;
          }
          lastToken += pendingChar + c;
          lastRawToken += pendingChar + c;
          pendingChar = '';
          break;

        case ')':
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + c;
            lastRawToken += pendingChar + c;
            pendingChar = '';
          }
          else {
            lastToken += pendingChar;
            lastRawToken += pendingChar;
            pendingChar = c;
          }
          break;

        case ',':
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + c;
            lastRawToken += pendingChar + c;
            pendingChar = '';
          }
          else {
            args.push(lastToken + pendingChar);
            rawArgs.push(lastRawToken + pendingChar);
            pendingChar = '';
            lastToken = '';
            lastRawToken = '';
          }
          break;

        case '"':
          if (inDoubleQuoteString) {
            inDoubleQuoteString = false;
            lastToken += pendingChar;
          }
          else if (!inSingleQuoteString) {
            inDoubleQuoteString = true;
          }
          else {
            lastToken += pendingChar;
          }
          lastRawToken += pendingChar + c;
          pendingChar = '';
          break;

        case "'":
          if (inSingleQuoteString) {
            inSingleQuoteString = false;
            lastToken += pendingChar;
          }
          else if (!inDoubleQuoteString) {
            inSingleQuoteString = true;
          }
          else {
            lastToken += pendingChar;
          }
          lastRawToken += pendingChar + c;
          pendingChar = '';
          break;

        default:
          if (inSingleQuoteString || inDoubleQuoteString) {
            lastToken += pendingChar + c;
            lastRawToken += pendingChar + c;
            pendingChar = '';
          }
          else if (!/\s/.test(c)) {
            lastRawToken += pendingChar
            if (lastRawToken != '')
              rawArgs.push(lastRawToken);
            throw new ReplacerSyntaxError(`Invalid Character "${c}" after "${replacer}${rawArgs.join(',')}", it must be quoted>`);
          }
          break;
      }
      count++;
    }
    if (lastRawToken != '') {
      rawArgs.push(lastRawToken);
      throw new ReplacerSyntaxError(`<ReplacerSyntaxError: Untermited Replacer "${replacer}${rawArgs.join(',')}", it must be terminated with ")%">`);
    }
  }
  return output;
}

function processOne(args, filler, fillerParams) {
  if (args.length < 1)
    throw new ReplacerSyntaxError(`<ReplacerSyntaxError: Replacer must take one or more arguments>`);
  if (args.length % 2 == 0)
    throw new ReplacerSyntaxError(`<ReplacerSyntaxError: Replacer must take one base text and pairs of matcher and replaced string>`);

  let filled = args.shift();
  if (typeof filler == 'function')
    filled = filler(filled, fillerParams);
  for (let i = 0, maxi = args.length; i < maxi; i += 2) {
    filled = filled.replace(new RegExp(args[i], 'i'), args[i + 1]);
  }
  return filled;
}
