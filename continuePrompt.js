/**
 * continuePrompt.js
 * ---------------------------------------------------------
 * Home-page-only: reads lifetime stats and, if the player has a
 * most-played mode, renders a "Continue with X" button above the
 * Lifetime Stats button. Absent entirely for a brand new player
 * with no history - there's nothing to "continue" yet, and an
 * empty/placeholder button would just be confusing clutter on a
 * first visit.
 *
 * This is the only script the home page loads, specifically
 * because everything else on the page is a plain <a href> that
 * works with zero JS - this one feature is inherently dynamic
 * (depends on stored data), so it's the one exception. (Well,
 * almost the only one - pickerIcons.js/pickerIconsInit.js also
 * load, to fill in the Continue button's arrow icon below; this
 * script must run BEFORE pickerIconsInit.js so the icon's
 * data-icon span already exists in the DOM by the time that
 * script scans the page for them - see the <script> order in
 * index.html.)
 * ---------------------------------------------------------
 */
(function () {
  if (!window.DartsTrainer || !window.DartsTrainer.lifetimeStats) {
    // Lifetime stats didn't load for some reason - fail silently
    // rather than breaking the rest of the (otherwise fully
    // static) home page. Worst case, the Continue button just
    // doesn't appear.
    return;
  }

  const { lifetimeStats } = window.DartsTrainer;
  const container = document.getElementById('continue-prompt');
  if (!container) return;

  /** @returns {{id:string,label:string,href:string,questionsAnswered:number}|null} The most-played mode, or null if nothing's been played yet. */
  function findMostPlayedMode() {
    const modes = lifetimeStats.getAllModeStats().filter((m) => m.questionsAnswered > 0);
    if (modes.length === 0) return null;

    return modes.reduce((best, mode) =>
      mode.questionsAnswered > best.questionsAnswered ? mode : best
    );
  }

  const mostPlayed = findMostPlayedMode();
  if (!mostPlayed) return; // new player, nothing to continue

  const link = document.createElement('a');
  link.href = mostPlayed.href;
  link.className = 'mode-button mode-button--continue';
  link.innerHTML = `
    <span class="mode-button__title">Continue with ${mostPlayed.label}</span>
    <span class="mode-button__badge mode-button__badge--icon">
      <span data-icon="arrowTriangle"></span>
    </span>
  `;

  // Inserted at the top of the group (before the Lifetime Stats
  // button already in the HTML), not appended - "continue playing"
  // is the more likely next action than "check my stats", so it
  // leads.
  container.insertBefore(link, container.firstChild);
})();
