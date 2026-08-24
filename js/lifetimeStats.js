/**
 * lifetimeStats.js
 * ---------------------------------------------------------
 * Persists per-mode statistics (questions answered, correct
 * answers, total time, longest correct-answer streak) to
 * localStorage, so progress survives across page reloads/
 * sessions - unlike StatsTracker (stats.js), which is
 * intentionally session-only and resets on every page load.
 * Also tracks a single global "Play Streak": the number of
 * consecutive calendar days on which the player has answered
 * at least one question in ANY mode. This module is DOM-
 * agnostic, same as stats.js; the lifetime-stats page
 * (lifetimeStatsUi.js) owns rendering.
 *
 * Storage shape (single localStorage key, one JSON blob so a
 * single read/write covers everything):
 * {
 *   modes: {
 *     "game":       { questionsAnswered, correctAnswers, totalTimeSeconds, bestStreak },
 *     "gameBoard":  { ... },
 *     ...
 *   },
 *   playStreak: { currentStreak, bestStreak, lastPlayedDate },
 *   profile: { name, favoriteTrebles: [n, n], favoriteDoubles: [n, n] }
 * }
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const STORAGE_KEY = 'dartsTrainer.lifetimeStats.v2';
  const LEGACY_STORAGE_KEY = 'dartsTrainer.lifetimeStats.v1'; // pre-streaks shape, still readable for migration

  // Central place for mode identity - shared by every page that
  // records or displays lifetime stats, so labels/ids can't drift.
  const MODES = [
    { id: 'game', label: '3-Dart Game', href: 'three-dart-game.html' },
    { id: 'gameBoard', label: '3-Dart Game (Dartboard)', href: 'three-dart-game-board.html' },
    { id: 'practice', label: '3-Dart Practice', href: '3-dart-practice.html' },
    { id: 'practiceBoard', label: '3-Dart Practice (Dartboard)', href: '3-dart-practice-board.html' },
    { id: 'streakPractice', label: '3-Dart Practice (Streak)', href: 'streak-practice.html' },
    { id: 'checkoutQuiz1Dart', label: '1-Dart Checkout Quiz', href: 'checkout-quiz.html' },
  ];

  // Dartboard numbers run 1-20 - favourite trebles/doubles are
  // always drawn from this range (no bull; a "favourite double"
  // of bull is arguably meaningful but the profile keeps to plain
  // numbers for now, consistent with how trebles have no bull
  // equivalent at all).
  const MIN_SEGMENT = 1;
  const MAX_SEGMENT = 20;
  const DEFAULT_FAVORITE_TREBLES = [20, 19];
  const DEFAULT_FAVORITE_DOUBLES = [20, 16];

  function emptyModeStats() {
    return { questionsAnswered: 0, correctAnswers: 0, totalTimeSeconds: 0, bestStreak: 0 };
  }

  function emptyPlayStreak() {
    return { currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
  }

  function defaultProfile() {
    return {
      name: '',
      favoriteTrebles: DEFAULT_FAVORITE_TREBLES.slice(),
      favoriteDoubles: DEFAULT_FAVORITE_DOUBLES.slice(),
    };
  }

  /**
   * Clamps a stored segment number back into 1-20, falling back to
   * the given default if it's missing, non-numeric, or out of
   * range - guards against a corrupted/hand-edited localStorage
   * value quietly breaking the profile dropdowns.
   * @param {*} value
   * @param {number} fallback
   * @returns {number}
   */
  function sanitizeSegment(value, fallback) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < MIN_SEGMENT || n > MAX_SEGMENT) return fallback;
    return n;
  }

  /**
   * Returns "today" as a plain YYYY-MM-DD string in the player's
   * local timezone (not UTC), so the streak lines up with the
   * calendar day they actually experience, and matches how it's
   * later compared/diffed as calendar days rather than 24h windows.
   * @param {Date} [date]
   * @returns {string}
   */
  function toDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** @returns {number} Whole calendar days between two YYYY-MM-DD keys (b - a). */
  function daysBetween(dateKeyA, dateKeyB) {
    const a = new Date(`${dateKeyA}T00:00:00`);
    const b = new Date(`${dateKeyB}T00:00:00`);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  /** Reads the full stored blob, tolerating missing/corrupt/legacy data. */
  function readAll() {
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (err) {
      // Corrupt JSON, or localStorage unavailable (e.g. private
      // browsing in some browsers) - fall back to empty rather than
      // throwing, since lifetime stats are a bonus, not core function.
      parsed = null;
    }

    // One-time migration from the pre-streaks v1 shape (a flat
    // modeId -> stats map, no bestStreak/playStreak) so upgrading
    // the app doesn't wipe out a player's existing totals.
    if (!parsed) {
      try {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
        if (legacy) parsed = { modes: legacy, playStreak: null };
      } catch (err) {
        parsed = null;
      }
    }

    const modes = {};
    MODES.forEach((mode) => {
      const stored = parsed && parsed.modes && parsed.modes[mode.id];
      modes[mode.id] = {
        questionsAnswered: Number(stored && stored.questionsAnswered) || 0,
        correctAnswers: Number(stored && stored.correctAnswers) || 0,
        totalTimeSeconds: Number(stored && stored.totalTimeSeconds) || 0,
        bestStreak: Number(stored && stored.bestStreak) || 0,
      };
    });

    const storedPlayStreak = parsed && parsed.playStreak;
    const playStreak = {
      currentStreak: Number(storedPlayStreak && storedPlayStreak.currentStreak) || 0,
      bestStreak: Number(storedPlayStreak && storedPlayStreak.bestStreak) || 0,
      lastPlayedDate: (storedPlayStreak && storedPlayStreak.lastPlayedDate) || null,
    };

    const storedProfile = parsed && parsed.profile;
    const defaults = defaultProfile();
    const profile = {
      name: typeof (storedProfile && storedProfile.name) === 'string' ? storedProfile.name : defaults.name,
      favoriteTrebles: [
        sanitizeSegment(storedProfile && storedProfile.favoriteTrebles && storedProfile.favoriteTrebles[0], defaults.favoriteTrebles[0]),
        sanitizeSegment(storedProfile && storedProfile.favoriteTrebles && storedProfile.favoriteTrebles[1], defaults.favoriteTrebles[1]),
      ],
      favoriteDoubles: [
        sanitizeSegment(storedProfile && storedProfile.favoriteDoubles && storedProfile.favoriteDoubles[0], defaults.favoriteDoubles[0]),
        sanitizeSegment(storedProfile && storedProfile.favoriteDoubles && storedProfile.favoriteDoubles[1], defaults.favoriteDoubles[1]),
      ],
    };

    return { modes, playStreak, profile };
  }

  function writeAll(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Storage full/unavailable - silently no-op. Lifetime stats
      // are supplementary; failing to save one shouldn't break the
      // app or interrupt the person mid-question.
    }
  }

  /**
   * Updates the global play streak for "today". Called once per
   * answered question (see recordAnswer) but cheap to call
   * repeatedly - same-day calls are no-ops after the first.
   *   - First time playing today, streak continuous from
   *     yesterday: currentStreak += 1.
   *   - First time playing today, but yesterday was missed (gap
   *     of 2+ days) or this is the very first time ever: streak
   *     restarts at 1.
   *   - Already played today: no change.
   * @param {{currentStreak:number, bestStreak:number, lastPlayedDate:string|null}} playStreak
   * @returns {{currentStreak:number, bestStreak:number, lastPlayedDate:string|null}}
   */
  function advancePlayStreak(playStreak) {
    const today = toDateKey();

    if (playStreak.lastPlayedDate === today) {
      return playStreak; // already played today, nothing to update
    }

    const isConsecutiveDay =
      playStreak.lastPlayedDate !== null && daysBetween(playStreak.lastPlayedDate, today) === 1;

    const nextCurrentStreak = isConsecutiveDay ? playStreak.currentStreak + 1 : 1;
    const nextBestStreak = Math.max(playStreak.bestStreak, nextCurrentStreak);

    return { currentStreak: nextCurrentStreak, bestStreak: nextBestStreak, lastPlayedDate: today };
  }

  /**
   * Records one answered question against a mode's lifetime totals,
   * and advances the global play streak for today.
   * @param {string} modeId - one of MODES[].id
   * @param {boolean} wasCorrect
   * @param {number} timeTakenSeconds
   */
  function recordAnswer(modeId, wasCorrect, timeTakenSeconds) {
    const all = readAll();
    const modeStats = all.modes[modeId] || emptyModeStats();

    modeStats.questionsAnswered += 1;
    modeStats.totalTimeSeconds += timeTakenSeconds;
    if (wasCorrect) modeStats.correctAnswers += 1;

    all.modes[modeId] = modeStats;
    all.playStreak = advancePlayStreak(all.playStreak);
    writeAll(all);
  }

  /**
   * Updates a mode's lifetime best-streak if the given session
   * streak value beats it. Called alongside recordAnswer whenever
   * a correct answer extends the session's current streak, so the
   * "longest ever" figure stays in sync without lifetimeStats.js
   * needing to reimplement session-streak tracking itself (that
   * logic already lives in StatsTracker - see stats.js - which is
   * the single source of truth for "how many in a row right now").
   * @param {string} modeId
   * @param {number} sessionCurrentStreak
   */
  function recordStreakProgress(modeId, sessionCurrentStreak) {
    const all = readAll();
    const modeStats = all.modes[modeId] || emptyModeStats();

    if (sessionCurrentStreak > modeStats.bestStreak) {
      modeStats.bestStreak = sessionCurrentStreak;
      all.modes[modeId] = modeStats;
      writeAll(all);
    }
  }

  /** @returns {{questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number, bestStreak:number}} */
  function getModeStats(modeId) {
    return readAll().modes[modeId] || emptyModeStats();
  }

  /** @returns {Array<{id:string, label:string, href:string, questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number, bestStreak:number}>} */
  function getAllModeStats() {
    const all = readAll();
    return MODES.map((mode) => Object.assign({}, mode, all.modes[mode.id]));
  }

  /** @returns {{questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number, bestStreak:number}} Totals summed across every mode; bestStreak is the highest of any single mode. */
  function getCombinedStats() {
    const all = readAll();
    return MODES.reduce((acc, mode) => {
      const s = all.modes[mode.id];
      acc.questionsAnswered += s.questionsAnswered;
      acc.correctAnswers += s.correctAnswers;
      acc.totalTimeSeconds += s.totalTimeSeconds;
      acc.bestStreak = Math.max(acc.bestStreak, s.bestStreak);
      return acc;
    }, emptyModeStats());
  }

  /** @returns {{currentStreak:number, bestStreak:number, lastPlayedDate:string|null}} The global "Play Streak" (consecutive days played, any mode). */
  function getPlayStreak() {
    return readAll().playStreak;
  }

  /** @param {{questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number}} stats */
  function accuracyPercent(stats) {
    if (stats.questionsAnswered === 0) return null;
    return (stats.correctAnswers / stats.questionsAnswered) * 100;
  }

  /** @param {{questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number}} stats */
  function averageTimeSeconds(stats) {
    if (stats.questionsAnswered === 0) return null;
    return stats.totalTimeSeconds / stats.questionsAnswered;
  }

  /** Wipes lifetime stats for every mode AND the play streak back to zero. The profile (name, favourite trebles/doubles) is untouched - it's account info, not a stat, so a stats reset shouldn't silently clear it too. */
  function resetAll() {
    const all = readAll();
    writeAll({ modes: {}, playStreak: emptyPlayStreak(), profile: all.profile });
  }

  /** Wipes lifetime stats for a single mode back to zero (play streak and profile untouched). */
  function resetMode(modeId) {
    const all = readAll();
    all.modes[modeId] = emptyModeStats();
    writeAll(all);
  }

  /** @returns {{name:string, favoriteTrebles:[number,number], favoriteDoubles:[number,number]}} */
  function getProfile() {
    return readAll().profile;
  }

  /**
   * Updates the player's display name.
   * @param {string} name
   */
  function setName(name) {
    const all = readAll();
    all.profile.name = String(name).slice(0, 40); // generous but bounded, in case of paste-in garbage
    writeAll(all);
  }

  /**
   * Sets one of the two favourite treble numbers (index 0 or 1).
   * If the given number matches the OTHER slot, the two are swapped
   * instead of ending up as a duplicate - e.g. favourites are
   * [20, 19] and the player sets slot 0 to 19: slot 1 becomes 20
   * rather than both slots reading 19. This keeps the pair always
   * distinct without the UI needing to reject the input outright.
   * @param {0|1} index
   * @param {number} segment - A whole number from 1-20.
   */
  function setFavoriteTreble(index, segment) {
    setFavoriteSegment('favoriteTrebles', index, segment);
  }

  /**
   * Sets one of the two favourite double numbers (index 0 or 1).
   * Same swap-on-duplicate behaviour as setFavoriteTreble.
   * @param {0|1} index
   * @param {number} segment - A whole number from 1-20.
   */
  function setFavoriteDouble(index, segment) {
    setFavoriteSegment('favoriteDoubles', index, segment);
  }

  /** Shared implementation for setFavoriteTreble/setFavoriteDouble - see their docs above. */
  function setFavoriteSegment(profileKey, index, segment) {
    const all = readAll();
    const clean = sanitizeSegment(segment, all.profile[profileKey][index]);
    const otherIndex = index === 0 ? 1 : 0;

    if (all.profile[profileKey][otherIndex] === clean) {
      // Duplicate - swap instead of clobbering, so both slots stay
      // meaningful (see setFavoriteTreble's doc comment).
      all.profile[profileKey][otherIndex] = all.profile[profileKey][index];
    }
    all.profile[profileKey][index] = clean;

    writeAll(all);
  }

  window.DartsTrainer.lifetimeStats = {
    MODES,
    MIN_SEGMENT,
    MAX_SEGMENT,
    recordAnswer,
    recordStreakProgress,
    getModeStats,
    getAllModeStats,
    getCombinedStats,
    getPlayStreak,
    accuracyPercent,
    averageTimeSeconds,
    resetAll,
    resetMode,
    getProfile,
    setName,
    setFavoriteTreble,
    setFavoriteDouble,
  };
})();
