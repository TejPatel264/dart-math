/**
 * loadCheckoutEngine.js
 * ---------------------------------------------------------
 * Test-only helper. Loads the REAL, unmodified js/checkoutEngine.js
 * source and returns the window.DartsTrainer.checkoutEngine object
 * it produces.
 *
 * checkoutEngine.js is a plain browser script (no module.exports,
 * attaches itself to a pre-existing `window` global) - this file
 * exists purely to give it that `window` to attach to when running
 * under Node, so the tests exercise the exact same source that
 * ships to the browser rather than a copy/port of its logic.
 *
 * Uses vm.runInThisContext (not vm.createContext) so the loaded
 * engine's arrays/objects share this process's Array/Object
 * prototypes - a separate vm context would create a distinct realm,
 * where the engine's own arrays are Array.isArray()===true but
 * instanceof Array===false against literals in the test file,
 * which breaks some of Node's assert helpers in confusing ways.
 *
 * IMPORTANT: this file must never alter, re-derive, or duplicate
 * checkoutEngine.js's logic - if this loader starts doing that,
 * the tests would stop testing the real implementation.
 * ---------------------------------------------------------
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCheckoutEngine() {
  const enginePath = path.join(__dirname, '..', 'js', 'checkoutEngine.js');
  const source = fs.readFileSync(enginePath, 'utf8');

  // Deliberately runInThisContext (NOT vm.createContext + runInContext):
  // createContext makes a genuinely separate JS realm with its own
  // Array/Object prototypes, so every array/object the engine
  // returns would be a "foreign" value here - Array.isArray() still
  // says true, but instanceof Array is false and some of Node's
  // assert helpers disagree with plain-object/array literals across
  // that boundary. runInThisContext executes the real file in the
  // SAME realm as this test process, sidestepping that entirely,
  // while still not requiring checkoutEngine.js to have any
  // module.exports (it only needs a `window` to exist first).
  const previousWindow = global.window;
  global.window = global.window || {};
  try {
    vm.runInThisContext(source, { filename: enginePath });
  } finally {
    // Restore whatever (if anything) window was before, so loading
    // this engine doesn't leak a global into other test files.
    const engine = global.window.DartsTrainer && global.window.DartsTrainer.checkoutEngine;
    global.window = previousWindow;
    if (!engine) {
      throw new Error(
        'checkoutEngine.js did not attach window.DartsTrainer.checkoutEngine - ' +
        'has its export shape changed? (tests/loadCheckoutEngine.js needs updating, ' +
        'not checkoutEngine.js itself)'
      );
    }
    return engine;
  }
}

module.exports = { loadCheckoutEngine };
