/**
 * aimModel.js
 * ---------------------------------------------------------
 * Turns the static probabilities in aimData.js into actual
 * random outcomes. Two jobs:
 *
 *  1. pickOutcomeForAim(aimKey) - given a dart aimed at e.g. T20,
 *     which segment does it actually land in?
 *
 *  2. pickNextAim(aimKey, wasHit) - given this dart's aim and
 *     whether it hit its target treble, what does the *next*
 *     dart aim for?
 *
 * Kept separate from aimData.js (the numbers) and gameEngine.js
 * (how a full visit/question is assembled), so each piece can be
 * reasoned about - and tuned - independently.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const { weightedRandomItem } = window.DartsTrainer.random;
  const { AIM_DEFINITIONS } = window.DartsTrainer.aimData;

  // Relative weights within a single aim, derived from the spec:
  // the single is most likely; the treble is half as likely as the
  // single; and hitting ANY ONE wayward segment is half as likely
  // as the treble (so the 4 wayward segments share that weight
  // equally, at a quarter each of the treble's weight).
  // Using whole numbers (16 : 8 : 1,1,1,1, total 28) avoids floating
  // point drift while keeping exactly the same ratios.
  const SINGLE_WEIGHT = 16;
  const TARGET_WEIGHT = 8;
  const WAYWARD_WEIGHT = 1; // each of the 4 wayward segments

  /**
   * @typedef {Object} ThrowOutcome
   * @property {string} notation - Display label, e.g. "T20".
   * @property {number} value    - Point value, e.g. 60.
   * @property {boolean} isTarget - True if this dart hit the treble it was aimed at.
   */

  /**
   * Resolves one dart thrown at the given aim into a landed segment.
   * @param {string} aimKey - "T20", "T19", or "T18".
   * @returns {ThrowOutcome}
   */
  function pickOutcomeForAim(aimKey) {
    const aim = AIM_DEFINITIONS[aimKey];

    const weightedOptions = [
      { item: { ...aim.single, isTarget: false }, weight: SINGLE_WEIGHT },
      { item: { ...aim.target, isTarget: true }, weight: TARGET_WEIGHT },
      ...aim.wayward.map((segment) => ({
        item: { ...segment, isTarget: false },
        weight: WAYWARD_WEIGHT,
      })),
    ];

    return weightedRandomItem(weightedOptions);
  }

  /**
   * Decides what the next dart aims for, based on whether this
   * dart hit its intended treble.
   * @param {string} aimKey - This dart's aim.
   * @param {boolean} wasHit - Whether this dart landed on its treble.
   * @returns {string} The next dart's aim.
   */
  function pickNextAim(aimKey, wasHit) {
    const aim = AIM_DEFINITIONS[aimKey];
    const transitionWeights = wasHit ? aim.nextAimIfHit : aim.nextAimIfMiss;

    // T18 has no transition table (never needed in a 3-dart visit) -
    // fall back to repeating the same aim rather than guessing.
    if (!transitionWeights) return aimKey;

    const weightedOptions = Object.entries(transitionWeights).map(([nextAimKey, weight]) => ({
      item: nextAimKey,
      weight,
    }));

    return weightedRandomItem(weightedOptions);
  }

  window.DartsTrainer.aimModel = { pickOutcomeForAim, pickNextAim };
})();
