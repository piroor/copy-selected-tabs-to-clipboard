/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as FunctionalPlaceHolder from './functional-placeholder.js';

export class ReplacerError extends Error {
  constructor(...args) {
    super(...args);
  }
}

export function processAll(input, filter) {
  return FunctionalPlaceHolder.processAll({
    name: 'replace',
    input,
    filter: (...args) => processOne(args, filter),
  });
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
