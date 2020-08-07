/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  try {
    function getMetaInfo(document, name) {
      const upperCase = name.toUpperCase();
      const lowerCase = name.toLowerCase();
      return document.evaluate(
        `/descendant::*[translate(local-name(), "META", "meta")="meta"][translate(@name, "${upperCase}", "${lowerCase}")="${lowerCase}" or translate(@property, "${upperCase}", "${lowerCase}")="${lowerCase}"]/attribute::content`,
        document,
        null,
        XPathResult.STRING_TYPE,
        null
      ).stringValue;
    }

    const OGPPrefix = (/\b([^\s:]+):\s+http:\/\/ogp.me\/ns#(?:\s|$)/.test(document.head.getAttribute('prefix')) && RegExp.$1) || 'og';

    const author = getMetaInfo(document, 'author') || getMetaInfo(document, 'twitter:author') || getMetaInfo(document, 'twitter:site') || '';
    const description = getMetaInfo(document, 'description') || getMetaInfo(document, `${OGPPrefix}:description`) || '';
    const keywords = getMetaInfo(document, 'keywords') || '';
    return {
      author,
      description,
      keywords
    };
  }
  catch(e) {
    return {
      error: String(e)
    };
  }
})();
