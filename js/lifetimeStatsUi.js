/**
 * lifetimeStatsUi.js
 * ---------------------------------------------------------
 * Entry point + rendering for lifetime-stats.html. Reads
 * persisted totals from lifetimeStats.js (localStorage-backed)
 * and renders: a combined summary across all modes, then a
 * breakdown card per mode. Self-contained (no gameEngine/reveal/
 * stopwatch needed - this page only displays history), so it's
 * a single file rather than split into main/ui like the game
 * pages.
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');

  if (missing.length > 0) {
    const message =
      'Lifetime Stats failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { lifetimeStats } = window.DartsTrainer;

  const elements = {
    profileName: document.getElementById('profile-name'),
    profileTreble0: document.getElementById('profile-treble-0'),
    profileTreble1: document.getElementById('profile-treble-1'),
    profileDouble0: document.getElementById('profile-double-0'),
    profileDouble1: document.getElementById('profile-double-1'),

    playStreakCurrent: document.getElementById('play-streak-current'),
    playStreakBest: document.getElementById('play-streak-best'),

    summaryAnswered: document.getElementById('summary-answered'),
    summaryAccuracy: document.getElementById('summary-accuracy'),
    summaryAvgTime: document.getElementById('summary-avg-time'),
    modesContainer: document.getElementById('lifetime-modes'),
    resetBtn: document.getElementById('lifetime-reset-btn'),
  };

  /** Fills a <select> with options 1-20 (dartboard numbers) - built once, values only change after. */
  function populateSegmentOptions(selectEl) {
    for (let n = lifetimeStats.MIN_SEGMENT; n <= lifetimeStats.MAX_SEGMENT; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = String(n);
      selectEl.appendChild(option);
    }
  }

  [elements.profileTreble0, elements.profileTreble1, elements.profileDouble0, elements.profileDouble1]
    .forEach(populateSegmentOptions);

  /**
   * Re-reads the profile from storage and refreshes every profile
   * field's displayed value - called after any change (including a
   * duplicate-triggered swap in the OTHER select of a pair, which
   * this instance's own change handler wouldn't otherwise know to
   * update).
   */
  function renderProfile() {
    const profile = lifetimeStats.getProfile();
    elements.profileName.value = profile.name;
    elements.profileTreble0.value = String(profile.favoriteTrebles[0]);
    elements.profileTreble1.value = String(profile.favoriteTrebles[1]);
    elements.profileDouble0.value = String(profile.favoriteDoubles[0]);
    elements.profileDouble1.value = String(profile.favoriteDoubles[1]);
  }

  elements.profileName.addEventListener('input', () => {
    lifetimeStats.setName(elements.profileName.value);
  });

  elements.profileTreble0.addEventListener('change', () => {
    lifetimeStats.setFavoriteTreble(0, Number(elements.profileTreble0.value));
    renderProfile();
  });
  elements.profileTreble1.addEventListener('change', () => {
    lifetimeStats.setFavoriteTreble(1, Number(elements.profileTreble1.value));
    renderProfile();
  });
  elements.profileDouble0.addEventListener('change', () => {
    lifetimeStats.setFavoriteDouble(0, Number(elements.profileDouble0.value));
    renderProfile();
  });
  elements.profileDouble1.addEventListener('change', () => {
    lifetimeStats.setFavoriteDouble(1, Number(elements.profileDouble1.value));
    renderProfile();
  });

  /** Formats a mode-stats object's accuracy as a string for display. */
  function formatAccuracy(modeStats) {
    const accuracy = lifetimeStats.accuracyPercent(modeStats);
    return accuracy === null ? '—' : `${accuracy.toFixed(0)}%`;
  }

  /** Formats a mode-stats object's average time as a string for display. */
  function formatAvgTime(modeStats) {
    const avgTime = lifetimeStats.averageTimeSeconds(modeStats);
    return avgTime === null ? '—' : `${avgTime.toFixed(2)}s`;
  }

  /** Builds the DOM for a single mode's breakdown card. */
  function buildModeCard(mode) {
    const card = document.createElement('div');
    card.className = 'lifetime-mode-card';

    const hasData = mode.questionsAnswered > 0;
    if (!hasData) card.classList.add('lifetime-mode-card--empty');

    card.innerHTML = `
      <div class="lifetime-mode-card__header">
        <h2 class="lifetime-mode-card__title">${mode.label}</h2>
      </div>
      <div class="lifetime-mode-card__grid">
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${mode.questionsAnswered}</span>
          <span class="lifetime-mode-card__label">Questions</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${formatAccuracy(mode)}</span>
          <span class="lifetime-mode-card__label">Accuracy</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${formatAvgTime(mode)}</span>
          <span class="lifetime-mode-card__label">Avg Time</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${mode.bestStreak}</span>
          <span class="lifetime-mode-card__label">Best Streak</span>
        </div>
      </div>
      ${hasData ? '' : '<p class="lifetime-mode-card__empty-note">No questions answered yet</p>'}
    `;

    return card;
  }

  /** Renders the profile, play streak, combined summary, and every mode's card from current storage. */
  function render() {
    renderProfile();

    const playStreak = lifetimeStats.getPlayStreak();
    elements.playStreakCurrent.textContent = playStreak.currentStreak;
    elements.playStreakBest.textContent = playStreak.bestStreak;

    const combined = lifetimeStats.getCombinedStats();
    elements.summaryAnswered.textContent = combined.questionsAnswered;
    elements.summaryAccuracy.textContent = formatAccuracy(combined);
    elements.summaryAvgTime.textContent = formatAvgTime(combined);

    elements.modesContainer.innerHTML = '';
    lifetimeStats.getAllModeStats().forEach((mode) => {
      elements.modesContainer.appendChild(buildModeCard(mode));
    });
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all lifetime stats? This clears totals, streaks, and your play streak for every mode and can\'t be undone. Your name and favourites are kept.'
    );
    if (!confirmed) return;

    lifetimeStats.resetAll();
    render();
  }

  elements.resetBtn.addEventListener('click', handleReset);

  render();
})();
