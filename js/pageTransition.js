/**
 * pageTransition.js
 * ---------------------------------------------------------
 * A small, page-agnostic helper for a simple fade transition
 * between pages in this multi-page app (no framework/router -
 * each "page" is a plain HTML file). Deliberately has no
 * knowledge of darts, home menus, or any specific page, so any
 * future page can opt in just by loading this script and adding
 * `data-transition` to its internal navigation links.
 *
 * Two independent pieces:
 *  1. Fade IN on load - pure CSS (see the page-fade-in animation
 *     in styles.css), so the page is never stuck invisible even
 *     if this script fails to load for some reason.
 *  2. Fade OUT before navigating - progressive enhancement via
 *     this script. If it doesn't run, links still work exactly
 *     as normal links; they just skip the fade-out.
 * ---------------------------------------------------------
 */
(function () {
  const FADE_OUT_MS = 180;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-transition]');
    if (!link) return;

    event.preventDefault();
    document.body.classList.add('page-leaving');

    setTimeout(() => {
      window.location.href = link.href;
    }, FADE_OUT_MS);
  });
})();
