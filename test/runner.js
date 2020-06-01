/*
 license: The MIT License, Copyright (c) 2020 YUKI "Piro" Hiroshi
*/
'use strict';

import * as TestReplacer from './test-replacer.js';

async function run() {
  const testCases = [
    TestReplacer,
  ];
  let runOnlyRunnable = false;
  let failureCount = 0;
  let errorCount = 0;
  findRunnable:
  for (const tests of testCases) {
    for (const name of Object.keys(tests)) {
      if (!name.startsWith('test'))
        continue;
      if (tests[name].runnable) {
        runOnlyRunnable = true;
        break findRunnable;
      }
    }
  }
  for (const tests of testCases) {
    const setup    = tests.setUp || tests.setup;
    const teardown = tests.tearDown || tests.teardown;
    for (const name of Object.keys(tests)) {
      if (!name.startsWith('test'))
        continue;
      if (runOnlyRunnable && !tests[name].runnable)
        continue;
      let shouldTearDown = true;
      try {
        if (typeof setup == 'function')
          await setup();
        await tests[name]();
        if (typeof teardown == 'function') {
          await teardown();
          shouldTearDown = false;
        }
        console.log(`Success: ${name}`);
      }
      catch(error) {
        try {
          if (shouldTearDown &&
              typeof teardown == 'function') {
            await teardown();
          }
          throw error;
        }
        catch(error) {
          if (error && error.name == 'AssertionError') {
            logFailure(name, error);
            failureCount++;
          }
          else {
            logError(name, error);
            errorCount++;
          }
        }
      }
    }
  }
  console.log('Done.');
  process.exit(failureCount + errorCount > 0 ? 1 : 0);
}

function logError(name, error) {
  console.log(`Error: ${name}`);
  console.error(error);
}

function logFailure(name, error) {
  console.log(`Failure: ${name}`);
  console.error(error);

/*  const item = mLogs.appendChild(document.createElement('li'));
  item.classList.add('failure');
  const description = item.appendChild(document.createElement('div'));
  description.classList.add('description');
  description.textContent = name;
  if (error.message) {
    description.appendChild(document.createElement('br'));
    description.appendChild(document.createTextNode(error.message));
  }

  const stack = item.appendChild(document.createElement('pre'));
  stack.classList.add('stack');
  stack.textContent = error.stack;

  if ('expected' in error) {
    const expectedBlock = item.appendChild(document.createElement('fieldset'));
    expectedBlock.appendChild(document.createElement('legend')).textContent = 'Expected';
    const expected = expectedBlock.appendChild(document.createElement('pre'));
    expected.classList.add('expected');
    expected.textContent = error.expected.trim();
  }

  const actualBlock = item.appendChild(document.createElement('fieldset'));
  actualBlock.appendChild(document.createElement('legend')).textContent = 'Actual';
  const actual = actualBlock.appendChild(document.createElement('pre'));
  actual.classList.add('actual');
  actual.textContent = error.actual.trim();

  if ('expected' in error) {
    const diffBlock = item.appendChild(document.createElement('fieldset'));
    diffBlock.appendChild(document.createElement('legend')).textContent = 'Difference';
    const diff = diffBlock.appendChild(document.createElement('pre'));
    diff.classList.add('diff');
    const range = document.createRange();
    range.selectNodeContents(diff);
    range.collapse(false);
    diff.appendChild(range.createContextualFragment(Diff.readable(error.expected, error.actual, true)));
    range.detach();
  }
*/
}

run();
