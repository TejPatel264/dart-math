/**
 * random.js
 * ---------------------------------------------------------
 * Generic random-selection helpers. Deliberately has no
 * knowledge of darts or scores — keeping it generic means it
 * can be reused by any future feature (checkout trainer,
 * dartboard visual input, etc.) without modification.
 *
 * Loaded as a plain script (not an ES module) so the app can
 * be opened directly from disk (file://) without needing a
 * local server. Everything attaches to the shared
 * `window.DartsTrainer` namespace instead of using
 * import/export.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

// Defined as plain functions (not object methods that rely on `this`)
// so they work correctly even when destructured elsewhere, e.g.
// `const { randomItem } = window.DartsTrainer.random`.

/**
 * Returns a random integer between min and max, inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array.
 * @param {Array<T>} items
 * @returns {T}
 * @template T
 */
function randomItem(items) {
  return items[randomIntInclusive(0, items.length - 1)];
}

/**
 * Returns a random element from an array, weighted by relative
 * weight rather than picked uniformly. Weights don't need to sum
 * to 1 or 100 - they're relative to each other (e.g. weights of
 * 4 and 1 mean the first option is 4x as likely as the second).
 * @param {{item: T, weight: number}[]} entries
 * @returns {T}
 * @template T
 */
function weightedRandomItem(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of entries) {
    if (roll < entry.weight) return entry.item;
    roll -= entry.weight;
  }

  // Floating-point safety net: rounding could theoretically leave
  // `roll` a hair past the last entry's weight.
  return entries[entries.length - 1].item;
}

window.DartsTrainer.random = { randomIntInclusive, randomItem, weightedRandomItem };
