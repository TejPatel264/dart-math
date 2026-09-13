/**
 * pickerIcons.bundle.js
 * ---------------------------------------------------------
 * Concatenation of pickerIcons.js + pickerIconsInit.js - these two
 * are loaded on EVERY page in the app (they draw the small icons
 * used in headers/pickers/nav), so merging them into one file cuts
 * one network request + one parse/execute cycle off every single
 * page load. Purely mechanical: each original file's content is
 * wrapped in its own IIFE below to guarantee it can never collide
 * with the other's top-level declarations, so this bundle behaves
 * identically to loading the two files separately in order.
 *
 * If you need to edit icon logic, edit pickerIcons.js or
 * pickerIconsInit.js directly (still present in this folder for
 * reference/editing) and re-run build_bundles.py - do not hand-edit
 * this generated file, changes will be lost on the next rebuild.
 * ---------------------------------------------------------
 */

// ===== pickerIcons.js =====
(function () {
/**
 * pickerIcons.js
 * ---------------------------------------------------------
 * Small inline SVG icons for the picker-page cards (see
 * game-picker.html, practice-picker.html, checkout-quiz-
 * picker.html) - built as markup strings here rather than as
 * external image files, consistent with how the dartboard itself
 * (js/dartboard.js) is drawn programmatically: no extra network
 * requests, crisp at any size, and themeable with the same colour
 * tokens as the rest of the app.
 *
 * Usage: each page includes this script, then calls
 * DartsTrainer.pickerIcons.<name>() to get an SVG string and sets
 * it as the innerHTML of a .picker-card__icon element. Kept as
 * plain string-returning functions (not DOM-building code) since
 * that's the simplest thing that works for static, non-interactive
 * artwork - no need for the DOM APIs the rest of the app uses for
 * elements that actually change over time.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  /**
   * Two overlapping rounded rectangles, echoing the in-game
   * flip-square shape - one "face down" (dashed, dim) behind one
   * "face up" (solid), suggesting the flip itself without needing
   * to animate anything.
   * @returns {string}
   */
  function flipCards() {
    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="16" width="34" height="34" rx="6" fill="#E7DEC4" stroke="#1C1A15" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="4 3" />
        <rect x="20" y="14" width="34" height="34" rx="6" fill="#FFFFFF" stroke="#1C1A15" stroke-opacity="0.35" stroke-width="2" />
        <text x="37" y="36" text-anchor="middle" font-family="'Space Mono', monospace" font-weight="700" font-size="15" fill="#1C1A15">60</text>
      </svg>
    `;
  }

  /**
   * A geometrically accurate mini dartboard: 20 segments in the
   * real board's numbering order, alternating cream/near-black
   * single areas with red/green treble and double rings, plus the
   * two-tone bull - the same structure and colour rules as the
   * full-size board in js/dartboard.js (see the comments there for
   * why: real proportions from a 451mm board / 170mm scoring
   * radius, treble/double rings alternating red-green, single
   * areas alternating cream-black). No segment numbers or dart
   * markers at this size - just the face itself, which is already
   * enough to read as "a dartboard" rather than a generic circle
   * of wedges.
   *
   * Computed with real polar-coordinate math (not hand-drawn
   * wedge paths) so it's trivially correct and easy to resize or
   * re-theme later - worth the extra code here since this same
   * approach is a natural fit for other small dartboard-shaped UI
   * this app might want down the line (e.g. a dartboard favicon,
   * or per-mode icons on the Lifetime Stats page).
   * @returns {string}
   */
  function dartboard() {
    // Same segment order and proportions as js/dartboard.js,
    // scaled down to fit a 64x64 icon with a small margin instead
    // of the full-size game board's pixel dimensions.
    const SEGMENT_COUNT = 20;
    const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
    const BOARD_RADIUS = 28;
    const CENTER = 32;

    const RADIUS_FRACTIONS = {
      bullInner: 6.35 / 170,
      bullOuter: 15.9 / 170,
      trebleInner: 99 / 170,
      trebleOuter: 107 / 170,
      doubleInner: 162 / 170,
      doubleOuter: 1,
    };

    /** @returns {[number, number]} Cartesian point for a polar coordinate, 0deg = 12 o'clock, clockwise. */
    function polarToPoint(r, angleDeg) {
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
    }

    /** @returns {string} An SVG path `d` for one ring-shaped wedge (inner arc to outer arc, both sides straight). */
    function ringSegmentPathD(rInner, rOuter, angleStart, angleEnd) {
      const [x1, y1] = polarToPoint(rOuter, angleStart);
      const [x2, y2] = polarToPoint(rOuter, angleEnd);
      const [x3, y3] = polarToPoint(rInner, angleEnd);
      const [x4, y4] = polarToPoint(rInner, angleStart);
      return (
        `M ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
        `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
        `L ${x3.toFixed(2)} ${y3.toFixed(2)} ` +
        `A ${rInner.toFixed(2)} ${rInner.toFixed(2)} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`
      );
    }

    const f = RADIUS_FRACTIONS;
    const bands = [
      { rInner: f.trebleOuter * BOARD_RADIUS, rOuter: f.doubleInner * BOARD_RADIUS, isRing: false },
      { rInner: f.doubleInner * BOARD_RADIUS, rOuter: f.doubleOuter * BOARD_RADIUS, isRing: true },
      { rInner: f.bullOuter * BOARD_RADIUS, rOuter: f.trebleInner * BOARD_RADIUS, isRing: false },
      { rInner: f.trebleInner * BOARD_RADIUS, rOuter: f.trebleOuter * BOARD_RADIUS, isRing: true },
    ];

    const singleColors = ['#F3ECD8', '#1C1A15']; // cream, near-black - matches --color-surface / --color-ink
    const ringColors = ['#B3272C', '#0F6B45']; // red, green - matches --color-red / --color-green

    let segments = '';
    for (let idx = 0; idx < SEGMENT_COUNT; idx += 1) {
      const isEven = idx % 2 === 0;
      const angleStart = idx * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
      const angleEnd = angleStart + SEGMENT_ANGLE;

      bands.forEach((band) => {
        const fill = band.isRing
          ? isEven
            ? ringColors[0]
            : ringColors[1]
          : isEven
          ? singleColors[0]
          : singleColors[1];
        const d = ringSegmentPathD(band.rInner, band.rOuter, angleStart, angleEnd);
        segments += `<path d="${d}" fill="${fill}" stroke="#1C1A15" stroke-width="0.4" stroke-opacity="0.5" />`;
      });
    }

    const bullOuterR = f.bullOuter * BOARD_RADIUS;
    const bullInnerR = f.bullInner * BOARD_RADIUS;

    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${CENTER}" cy="${CENTER}" r="${BOARD_RADIUS + 1}" fill="#1C1A15" />
        ${segments}
        <circle cx="${CENTER}" cy="${CENTER}" r="${bullOuterR.toFixed(2)}" fill="${ringColors[1]}" stroke="#1C1A15" stroke-width="0.4" stroke-opacity="0.5" />
        <circle cx="${CENTER}" cy="${CENTER}" r="${bullInnerR.toFixed(2)}" fill="${ringColors[0]}" stroke="#1C1A15" stroke-width="0.4" stroke-opacity="0.5" />
        <circle cx="${CENTER}" cy="${CENTER}" r="${BOARD_RADIUS + 1}" fill="none" stroke="#1C1A15" stroke-opacity="0.35" stroke-width="1.5" />
      </svg>
    `;
  }

  /**
   * A single dart: a thin needle point, two rounded barrel
   * sections separated by a narrow grip band, a short shaft, and a
   * swallowtail-style flight (one connected shape, narrow at the
   * shaft and flaring to two points with a shallow V-notch cut
   * into the trailing edge) - not a literal 3-4 vane cross-section,
   * since that doesn't read cleanly at small sizes. Point faces
   * the top-right, flight trails off to the bottom-left.
   *
   * Drawn directly along that diagonal axis (not built horizontally
   * and rotated afterward), using a small "walk along the axis,
   * offset perpendicular" coordinate helper so every part's
   * position is expressed as "how far along the dart, how far to
   * the side" rather than raw x/y pairs - this makes the whole
   * shape easy to re-angle later (as happened once already) by
   * changing a single ANGLE_DEG/TIP pair instead of recalculating
   * every coordinate by hand.
   *
   * Built once as its own function (not inlined per-card) since a
   * good dart silhouette is generically useful anywhere else in
   * the app that wants one later (e.g. a favicon, a loading
   * indicator, other picker cards), not just the checkout quiz's
   * dart-count picker.
   * @param {number} [x=0] - horizontal offset for laying multiple darts side by side
   * @param {number} [scale=1] - uniform scale (around the icon's centre), for shrinking darts when several share one icon
   * @returns {string} a <g> element (not a standalone <svg>)
   */
  function singleDart(x = 0, scale = 1) {
    // The dart's own axis runs at 135deg, starting from the tip at
    // the top-right corner and walking down-left. `along(t)` walks
    // a distance t down that axis from the tip; `at(t, w)` is the
    // point at distance t, offset w perpendicular to the axis.
    const ANGLE_DEG = 135;
    const rad = (ANGLE_DEG * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const px = -uy;
    const py = ux;
    const TIP = [54, 10];

    function along(t) {
      return [TIP[0] + ux * t, TIP[1] + uy * t];
    }
    function at(t, w) {
      const [bx, by] = along(t);
      return [bx + px * w, by + py * w];
    }
    function fmt(p) {
      return `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    }

    // Distances along the axis marking where each part starts/ends.
    const T_POINT_BASE = 13.6;
    const T_BARREL1_END = 20.5;
    const T_BARREL2_START = 21.7; // the gap between the two barrel sections
    const T_BARREL2_END = 31.6;
    const T_SHAFT_END = 39.1;
    const T_FLIGHT_END = 58;

    // Point: a thin needle tapering to a sharp tip.
    const pointD = `M ${fmt(at(0, 0))} L ${fmt(at(T_POINT_BASE, 0.9))} L ${fmt(at(T_POINT_BASE, -0.9))} Z`;

    /** A rounded-capsule barrel section from t1 to t2 with half-width w. */
    function barrelSection(t1, t2, w) {
      return (
        `M ${fmt(at(t1, w))} ` +
        `L ${fmt(at(t2 - 1.2, w))} ` +
        `Q ${fmt(at(t2, w))} ${fmt(at(t2, w * 0.55))} ` +
        `L ${fmt(at(t2, -w * 0.55))} ` +
        `Q ${fmt(at(t2, -w))} ${fmt(at(t2 - 1.2, -w))} ` +
        `L ${fmt(at(t1, -w))} ` +
        `Q ${fmt(at(t1 - 1, -w))} ${fmt(at(t1 - 1, 0))} ` +
        `Q ${fmt(at(t1 - 1, w))} ${fmt(at(t1, w))} Z`
      );
    }
    // Two barrel sections (grip nearest the point, then a longer
    // section toward the shaft) with a narrow gap between them - the
    // grip-ring detail visible on a real dart barrel.
    const barrel1D = barrelSection(T_POINT_BASE, T_BARREL1_END, 2.3);
    const barrel2D = barrelSection(T_BARREL2_START, T_BARREL2_END, 2.6);

    // Shaft: thin straight stem connecting the barrel to the flight.
    const shaftD =
      `M ${fmt(at(T_BARREL2_END, 1))} L ${fmt(at(T_SHAFT_END, 1))} ` +
      `L ${fmt(at(T_SHAFT_END, -1))} L ${fmt(at(T_BARREL2_END, -1))} Z`;

    // Flight: one connected swallowtail shape - narrow at the
    // shaft, flaring out to two points at the back with a shallow
    // V-notch cut into the trailing edge.
    const flightHalfW = 6.5;
    const notchDepth = 4;
    const flightD =
      `M ${fmt(at(T_SHAFT_END, 0.8))} ` +
      `L ${fmt(at(T_FLIGHT_END, flightHalfW))} ` +
      `L ${fmt(at(T_FLIGHT_END - notchDepth, 0))} ` +
      `L ${fmt(at(T_FLIGHT_END, -flightHalfW))} ` +
      `L ${fmt(at(T_SHAFT_END, -0.8))} Z`;

    return `
      <g transform="translate(${x} 0)">
        <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
          <path d="${flightD}" fill="#B3272C" />
          <path d="${shaftD}" fill="#1C1A15" />
          <path d="${barrel2D}" fill="#C7A34B" stroke="#8C6D2E" stroke-width="0.4" />
          <path d="${barrel1D}" fill="#C7A34B" stroke="#8C6D2E" stroke-width="0.4" />
          <path d="${pointD}" fill="#6E6555" />
        </g>
      </g>
    `;
  }

  /**
   * A group of 1-3 darts, used for the checkout quiz's dart-count
   * picker cards ("1-Dart", "2-Dart", "3-Dart") - laid out side by
   * side (matching how multiple darts are conventionally shown
   * together, like in a hand or a card back), shrunk just enough
   * that they don't overlap given the dart's diagonal silhouette.
   * @param {number} count - 1, 2, or 3
   * @returns {string}
   */
  function dartGroup(count) {
    const LAYOUTS = {
      1: { scale: 1, xStep: 0 },
      2: { scale: 0.8, xStep: 15 },
      3: { scale: 0.66, xStep: 14 },
    };
    const { scale, xStep } = LAYOUTS[count] || LAYOUTS[1];

    const darts = Array.from({ length: count }, (_, i) => {
      const x = (-(count - 1) / 2 + i) * xStep;
      return singleDart(x, scale);
    }).join('');

    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        ${darts}
      </svg>
    `;
  }

  /**
   * A small "trending up" bar chart - 3 ascending bars - used to
   * replace the Lifetime Stats button's emoji on the home page.
   * Sized to sit inline with button text (not a full picker-card
   * icon), so it's simpler/flatter than the picker icons above:
   * no rotation, no colour alternation, just a clean glyph that
   * reads as "your stats/progress" at a glance.
   * @returns {string}
   */
  function statsChart() {
    return `
      <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="11" width="4" height="7" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="8" y="7" width="4" height="11" rx="1" fill="currentColor" opacity="0.75" />
        <rect x="14" y="2" width="4" height="16" rx="1" fill="currentColor" />
      </svg>
    `;
  }

  /**
   * A simple solid triangle arrow, pointing right by default,
   * precisely centred in its 20x20 box by construction (unlike a
   * Unicode arrow/triangle character, whose glyph metrics vary by
   * font and are rarely centred in their own bounding box - that
   * mismatch was the actual cause of the home-page back link and
   * "Continue with X" badge both looking visually off-centre
   * despite correct CSS centring on their containers). Used
   * pointing right as-is for the Continue badge, and flipped via
   * a CSS transform (scaleX(-1)) for the back-to-home link - one
   * shape, one source of truth, instead of two different glyphs
   * that each need their own manual centring.
   * @returns {string}
   */
  function arrowTriangle() {
    return `
      <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 14 10 L 6 4 L 6 16 Z" fill="currentColor" />
      </svg>
    `;
  }

  /**
   * A simple two-tone flame - a red outer teardrop shape (with a
   * small flicker notch on one side, so it doesn't read as a
   * perfectly symmetric raindrop) and a cream inner core - used to
   * replace the play-streak banner's fire emoji on the Lifetime
   * Stats page. Colours chosen for contrast against that banner's
   * gold gradient background specifically (see .play-streak in
   * styles.css) rather than currentColor, since red-on-gold and
   * cream-on-gold both need to read clearly there and wouldn't
   * necessarily if left to inherit an arbitrary text colour.
   * @returns {string}
   */
  function flame() {
    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 32 4 C 40 16 46 24 44 34 C 43 42 37 48 32 48 C 22 48 16 40 17 30 C 17.5 25 20 21 23 18 C 21 24 22 29 25 31 C 24 22 27 12 32 4 Z" fill="#B3272C" />
        <path d="M 30 22 C 34 28 37 32 36 37 C 35.5 41 32 44 29 44 C 24 44 21 40 21.5 35 C 21.8 32 23.5 29.5 25.5 28 C 24.8 31 25.5 33.5 27 35 C 26 30 27.5 26 30 22 Z" fill="#F3ECD8" />
      </svg>
    `;
  }

  /**
   * A simple infinity loop (two crossed loops), used for the
   * "Unlimited" game-length card on the picker pages - reads
   * clearly at small size as "no limit" without needing a text
   * label to explain it. currentColor so it matches whatever
   * colour the card's own text/icon treatment already applies
   * (including the dimmed opacity picker-card__icon uses when a
   * card is unselected - see styles.css).
   * @returns {string}
   */
  function infinity() {
    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 20 32 C 20 24 27 20 32 26 C 37 32 44 40 50 32 C 56 24 44 16 38 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <path d="M 44 32 C 44 24 37 20 32 26 C 27 32 20 40 14 32 C 8 24 20 16 26 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
      </svg>
    `;
  }

  /**
   * A plain clock face - two hands slightly off twelve so it
   * doesn't read as a static/frozen glyph - for the "Timer" coming-
   * soon card. currentColor throughout, same reasoning as
   * infinity() above.
   * @returns {string}
   */
  function clock() {
    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="4" />
        <path d="M 32 20 L 32 33 L 41 38" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  window.DartsTrainer.pickerIcons = {
    flipCards,
    dartboard,
    dartGroup,
    statsChart,
    arrowTriangle,
    flame,
    infinity,
    clock,
  };
})();

})();

// ===== pickerIconsInit.js =====
(function () {
/**
 * pickerIconsInit.js
 * ---------------------------------------------------------
 * Populates every icon slot on the page - .picker-card__icon on
 * the picker pages, .mode-button__icon on the home page - from
 * its data-icon (and, for dartGroup, data-icon-count) attribute.
 * Shared across every page that wants one of these icons so each
 * page's HTML only needs to declare WHICH icon a slot wants, not
 * repeat the SVG markup itself - see js/pickerIcons.js for where
 * that markup actually comes from.
 * ---------------------------------------------------------
 */
(function () {
  if (!window.DartsTrainer || !window.DartsTrainer.pickerIcons) {
    // Icons are a purely decorative enhancement - if the icon
    // module didn't load for some reason, the buttons/cards still
    // work fine as plain text, so fail silently rather than
    // breaking navigation.
    return;
  }

  const { pickerIcons } = window.DartsTrainer;

  document.querySelectorAll('[data-icon]').forEach((el) => {
    const iconName = el.dataset.icon;
    const builder = pickerIcons[iconName];
    if (typeof builder !== 'function') return;

    if (iconName === 'dartGroup') {
      const count = Number(el.dataset.iconCount) || 1;
      el.innerHTML = builder(count);
    } else {
      el.innerHTML = builder();
    }
  });
})();

})();
