/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export class PlaceHolderParserError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function process(input, processor, processedInput = '', logger = (() => {})) {
  let output = '';

  let lastToken = '';
  let inPlaceHolder = false;
  let inArgsPart = false;
  let inSingleQuoteString = false;
  let inDoubleQuoteString = false;
  let escaped = false;

  let name = '';
  let args = [];
  let rawArgs = '';

  for (const character of input) {
    processedInput += character;
    //console.log({input, character, lastToken, inPlaceHolder, inSingleQuoteString, inDoubleQuoteString, inArgsPart, escaped, output, name, args});

    if (escaped) {
      lastToken += character;
      if (inArgsPart)
        rawArgs += character;
      escaped = false;
      continue;
    }

    switch (character) {
      case '\\':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (!escaped) {
          escaped = true;
          continue;
        }

        if (inArgsPart)
          rawArgs += character;

        lastToken += character;
        continue;

      case '%':
        if (!inPlaceHolder) {
          inPlaceHolder = true;
          output += lastToken;
          lastToken = '';
          continue;
        }

        if (inArgsPart)
          rawArgs += character;

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
            throw new PlaceHolderParserError(`Missing placeholder name: ${processedInput}`);
        }

        inPlaceHolder = false;
        try {
          logger('parser: placeholder ', { name, rawArgs, args });
          output += processor(name, rawArgs, ...args);
        }
        catch(error) {
          throw new PlaceHolderParserError(`Unhandled error: ${error.message}\n${error.stack}`);
        }
        lastToken = '';
        name = '';
        args = [];
        rawArgs = '';
        continue;

      case '(':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inArgsPart)
          rawArgs += character;
        else if (rawArgs != '')
          rawArgs += ', ';

        if (inSingleQuoteString ||
            inDoubleQuoteString ||
            inArgsPart) {
          lastToken += character;
          continue;
        }

        inArgsPart = true;
        if (name == '' && lastToken != '')
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
          if (inArgsPart)
            rawArgs += character;
          lastToken += character;
          continue;
        }

        inArgsPart = false;
        if (rawArgs.trim() != '')
          args.push(process(lastToken, processor, processedInput));
        lastToken = '';
        continue;

      case ',':
        if (!inPlaceHolder) {
          output += character;
          lastToken = '';
          continue;
        }

        if (inArgsPart)
          rawArgs += character;

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

        if (inArgsPart)
          rawArgs += character;

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

        if (inArgsPart)
          rawArgs += character;

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

        if (inArgsPart)
          rawArgs += character;

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
    throw new PlaceHolderParserError(`Unterminated placeholder: ${processedInput}`);

  if (inArgsPart)
    throw new PlaceHolderParserError(`Unterminated arguments for the placeholder "${name}": ${processedInput}`);

  if (inSingleQuoteString ||
      inDoubleQuoteString)
    throw new PlaceHolderParserError(`Unterminated string: ${processedInput}`);

  if (escaped)
    output += '\\';

  return output;
}
