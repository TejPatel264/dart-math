/**
 * revealSequence.js
 * ---------------------------------------------------------
 * Generic helper for revealing a list of items one at a time,
 * with a delay between each. Used here to flip the three dart
 * squares in sequence, but deliberately has no knowledge of
 * darts, squares, or the DOM - it just calls back with each
 * item in turn - so it can be reused by any future feature
 * that needs a staged reveal (e.g. a 3-dart checkout sequence).
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

/**
 * Reveals each item in `items` one by one.
 * @param {Array<T>} items - The items to reveal, in order.
 * @param {Object} options
 * @param {number} [options.firstDelayMs=500] - Delay before the first reveal.
 * @param {number} [options.stepDelayMs=2000] - Delay between each subsequent reveal.
 * @param {(item: T, index: number) => void} options.onReveal - Called for each item as it's revealed.
 * @param {() => void} [options.onComplete] - Called once, after the final item is revealed.
 * @returns {() => void} A cancel function that stops any remaining reveals.
 * @template T
 */
function revealSequence(items, { firstDelayMs = 500, stepDelayMs = 2000, onReveal, onComplete }) {
  const timers = items.map((item, index) => {
    const delay = firstDelayMs + index * stepDelayMs;
    return setTimeout(() => {
      onReveal(item, index);
      if (index === items.length - 1 && onComplete) onComplete();
    }, delay);
  });

  // Returning a cancel function lets the caller stop a reveal in
  // progress - e.g. if a new question starts before the old one finishes.
  return function cancel() {
    timers.forEach(clearTimeout);
  };
}

window.DartsTrainer.revealSequence = revealSequence;
