/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export class PlaceHolderError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function process(input, processor, processedInput = '') {
  let output = '';

  let lastToken = '';
  let inPlaceHolder = false;
  let inArgsPart = false;
  let inSingleQuoteString = false;
  let inDoubleQuoteString = false;
  let escaped = false;

  let name = '';
  let args = [];

  for (const character of input) {
    processedInput += character;
    //console.log({input, character, lastToken, inPlaceHolder, inSingleQuoteString, inDoubleQuoteString, inArgsPart, escaped, output, name, args});

    if (escaped) {
      lastToken += character;
      escaped = false;
      continue;
    }

    switch (character) {
      case '\\':
        if (!escaped) {
          escaped = true;
          continue;
        }

        lastToken += character;
        continue;

      case '%':
        if (!inPlaceHolder) {
          inPlaceHolder = true;
          output += lastToken;
          lastToken = '';
          continue;
        }

        if (inSingleQuoteString ||
            inDoubleQuoteString ||
            inArgsPart) {
          lastToken += character;
          continue;
        }

        if (!name) {
          if (lastToken != '')
            name = lastToken;
          else
            throw new PlaceHolderError(`Missing placeholder name: ${processedInput}`);
        }

        inPlaceHolder = false;
        output += processor(name, ...args);
        lastToken = '';
        name = '';
        args = [];
        continue;

      case '(':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inSingleQuoteString ||
            inDoubleQuoteString ||
            inArgsPart) {
          lastToken += character;
          continue;
        }

        inArgsPart = true;
        name = lastToken;
        lastToken = '';
        continue;

      case ')':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inSingleQuoteString ||
            inDoubleQuoteString ||
            !inArgsPart) {
          lastToken += character;
          continue;
        }

        inArgsPart = false;
        args.push(process(lastToken, processor, processedInput));
        lastToken = '';
        continue;

      case ',':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inSingleQuoteString ||
            inDoubleQuoteString ||
            !inArgsPart) {
          lastToken += character;
          continue;
        }

        args.push(process(lastToken, processor, processedInput));
        lastToken = '';
        continue;

      case '"':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inSingleQuoteString) {
          lastToken += character;
          continue;
        }

        if (inDoubleQuoteString) {
          inDoubleQuoteString = false;
          continue;
        }

        inDoubleQuoteString = true;
        continue;

      case "'":
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inDoubleQuoteString) {
          lastToken += character;
          continue;
        }

        if (inSingleQuoteString) {
          inSingleQuoteString = false;
          continue;
        }

        inSingleQuoteString = true;
        continue;

      default:
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (character.trim() == '') { // whitespace
          if (inSingleQuoteString ||
              inDoubleQuoteString ||
              !inArgsPart) {
            lastToken += character;
          }
        }
        else {
          lastToken += character;
        }
        continue;
    }
  }

  if (inPlaceHolder)
    throw new PlaceHolderError(`Unterminated placeholder: ${processedInput}`);

  if (inArgsPart)
    throw new PlaceHolderError(`Unterminated arguments for the placeholder "${name}": ${processedInput}`);

  if (inSingleQuoteString ||
      inDoubleQuoteString)
    throw new PlaceHolderError(`Unterminated string: ${processedInput}`);

  if (escaped)
    output += '\\';

  return output;
}
