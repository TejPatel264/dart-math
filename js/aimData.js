/**
 * aimData.js
 * ---------------------------------------------------------
 * Models a real dart player "aiming" at a treble, and the
 * neighbouring segments a dart can realistically land in if
 * that aim is slightly off.
 *
 * On a physical board, the segments either side of a number are
 * fixed by the board's layout:
 *   - Aiming at T20 -> can land in 20, 1, or 5
 *   - Aiming at T19 -> can land in 19, 3, or 7
 *   - Aiming at T18 -> can land in 18, 1, or 4
 *
 * Each aim also carries the transition weights used to decide
 * what the *next* dart aims at, based on whether this dart hit
 * its intended treble or not (see aimModel.js for how these are
 * used). T18 has no transition table because a visit is only 3
 * darts, so nothing ever needs to aim "after" a T18 dart - if a
 * future feature adds a 4th dart, aimModel.js falls back to
 * repeating the same aim rather than guessing new numbers here.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

const AIM_DEFINITIONS = {
  T20: {
    target: { notation: 'T20', value: 60 },
    single: { notation: '20', value: 20 },
    wayward: [
      { notation: '1', value: 1 },
      { notation: 'T1', value: 3 },
      { notation: '5', value: 5 },
      { notation: 'T5', value: 15 },
    ],
    // Aim for the NEXT dart, given this dart hit the T20 / missed it.
    nextAimIfHit: { T20: 0.9, T19: 0.1 },
    nextAimIfMiss: { T20: 0.75, T19: 0.25 },
  },
  T19: {
    target: { notation: 'T19', value: 57 },
    single: { notation: '19', value: 19 },
    wayward: [
      { notation: '3', value: 3 },
      { notation: 'T3', value: 9 },
      { notation: '7', value: 7 },
      { notation: 'T7', value: 21 },
    ],
    nextAimIfHit: { T19: 0.9, T18: 0.1 },
    nextAimIfMiss: { T19: 0.75, T18: 0.25 },
  },
  T18: {
    target: { notation: 'T18', value: 54 },
    single: { notation: '18', value: 18 },
    wayward: [
      { notation: '1', value: 1 },
      { notation: 'T1', value: 3 },
      { notation: '4', value: 4 },
      { notation: 'T4', value: 12 },
    ],
    // No nextAimIfHit/nextAimIfMiss: never needed within a 3-dart visit.
  },
};

// The first dart of every visit always aims for T20.
const FIRST_AIM = 'T20';

window.DartsTrainer.aimData = { AIM_DEFINITIONS, FIRST_AIM };
