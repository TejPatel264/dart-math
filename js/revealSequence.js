/**
 * revealSequence.js
 * ---------------------------------------------------------
 * Generic helper for revealing a list of items one at a time.
 * Used here to flip the three dart squares (or land the three
 * darts on the board) in sequence, but deliberately has no
 * knowledge of darts, squares, or the DOM - it just calls back
 * with each item in turn - so it can be reused by any future
 * feature that needs a staged reveal (e.g. a 3-dart checkout
 * sequence).
 *
 * The delay before each reveal is randomized within its own range
 * rather than fixed - a constant rhythm is easy to answer along to
 * without actually reading the throws, so each gap is redrawn per
 * question from a uniform distribution: 0.3-0.7s before the 1st
 * reveal, 1.0-2.0s between the 1st and 2nd, 1.3-2.0s between the
 * 2nd and 3rd. The ranges themselves are fixed (not randomized),
 * only where each individual gap lands within its range.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

/**
 * Returns a random number drawn uniformly from [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Reveals each item in `items` one by one.
 * @param {Array<T>} items - The items to reveal, in order.
 * @param {Object} options
 * @param {[number, number]} [options.firstDelayRangeMs=[300, 700]] - Uniform range for the
 *   delay before the 1st reveal.
 * @param {[number, number]} [options.gap1to2RangeMs=[1000, 2000]] - Uniform range for the
 *   delay between the 1st and 2nd reveal.
 * @param {[number, number]} [options.gap2to3RangeMs=[1300, 2000]] - Uniform range for the
 *   delay between the 2nd and 3rd reveal.
 * @param {(item: T, index: number) => void} options.onReveal - Called for each item as it's revealed.
 * @param {() => void} [options.onComplete] - Called once, after the final item is revealed.
 * @returns {() => void} A cancel function that stops any remaining reveals.
 * @template T
 */
function revealSequence(
  items,
  {
    firstDelayRangeMs = [300, 700],
    gap1to2RangeMs = [1000, 2000],
    gap2to3RangeMs = [1300, 2000],
    onReveal,
    onComplete,
  }
) {
  // Each item's absolute delay builds on the previous one's, using
  // a freshly-drawn gap for each step - items beyond the 3rd (if
  // this is ever reused for a longer sequence) keep reusing the
  // 2nd-3rd range rather than erroring, since there's no 4th range
  // specified.
  const delays = [];
  items.forEach((item, index) => {
    if (index === 0) {
      delays.push(randomBetween(firstDelayRangeMs[0], firstDelayRangeMs[1]));
    } else {
      const range = index === 1 ? gap1to2RangeMs : gap2to3RangeMs;
      delays.push(delays[index - 1] + randomBetween(range[0], range[1]));
    }
  });

  const timers = items.map((item, index) =>
    setTimeout(() => {
      onReveal(item, index);
      if (index === items.length - 1 && onComplete) onComplete();
    }, delays[index])
  );

  // Returning a cancel function lets the caller stop a reveal in
  // progress - e.g. if a new question starts before the old one finishes.
  return function cancel() {
    timers.forEach(clearTimeout);
  };
}

window.DartsTrainer.revealSequence = revealSequence;
