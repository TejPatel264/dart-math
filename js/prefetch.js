/**
 * prefetch.js
 * ---------------------------------------------------------
 * A tiny helper for hinting the browser to fetch a page (and, via
 * that page's own <link rel="preload"> font tags, warm those up
 * too) before the player actually taps through to it - used from
 * setupPicker.js (prefetch whichever gameplay page is currently
 * selected on the Game Mode/View picker, so it's re-targeted every
 * time the selection changes) and from index.html (prefetch the
 * COUNT/TRACK picker pages, since those are the two most likely
 * next taps from the home screen).
 *
 * This is a pure browser hint with no loading state, no JS-side
 * delay, and no navigation logic of its own - it only ever makes
 * an eventual real navigation faster, never slower or different.
 * A page that was already prefetched (or is mid-prefetch) when the
 * player taps through just navigates immediately, the same way it
 * always would; nothing here is on the critical path of an actual
 * click.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const prefetchedHrefs = new Set();

  /**
   * Hints the browser to fetch `href` in the background, if it
   * hasn't already been asked to for this href on this page. Safe
   * to call repeatedly (e.g. every time the picker's selection
   * changes) - already-prefetched hrefs are skipped rather than
   * queuing duplicate hints.
   * @param {string} href
   */
  function prefetchPage(href) {
    if (!href || prefetchedHrefs.has(href)) return;
    prefetchedHrefs.add(href);

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  window.DartsTrainer.prefetchPage = prefetchPage;
})();
