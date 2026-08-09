/**
 * dartboard.js
 * ---------------------------------------------------------
 * Builds an accurately-proportioned SVG dartboard and places
 * dart markers at random (but *correct*) positions within a
 * given segment and ring - e.g. a "T20" throw lands somewhere
 * random inside the thin treble-20 wedge, never in the single,
 * double, or any other segment's area.
 *
 * Pure geometry + SVG construction, no game logic and no
 * knowledge of the aim model - it just needs a notation string
 * ("T20", "20", "5", ...) and answers "where does that land?".
 * This keeps it reusable by any future mode that wants a board
 * (1-dart game, a checkout trainer with doubles, etc).
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  // Standard dartboard segment order, clockwise from 12 o'clock.
  const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const SEGMENT_ANGLE = 360 / SEGMENT_ORDER.length; // 18 degrees per wedge

  // Radii as fractions of the board's outer (double-ring) radius,
  // taken from real dartboard proportions (451mm board, 170mm
  // scoring radius) so the treble/double rings are genuinely thin
  // relative to the single areas, not just decoratively so.
  const RADIUS_FRACTIONS = {
    bullInner: 6.35 / 170,
    bullOuter: 15.9 / 170,
    trebleInner: 99 / 170,
    trebleOuter: 107 / 170,
    doubleInner: 162 / 170,
    doubleOuter: 1,
  };

  // Keep darts from visually touching a dividing wire or the very
  // edge of a ring - purely cosmetic insets, applied as a fraction
  // of the available angular/radial span for that zone.
  const ANGLE_INSET_FRACTION = 0.14;
  const RADIUS_INSET_FRACTION = 0.12;

  // Minimum separation (in board-coordinate px) between dart
  // markers so a later dart never visually sits on top of an
  // earlier one, even if their random points landed close together.
  // Deliberately modest: the treble ring is genuinely narrow (real
  // dartboards are ~8mm wide there), so 3 darts sharing a treble
  // wedge SHOULD look tight - the goal is just "3 distinguishable
  // dots", not generous spacing.
  const MIN_DART_SEPARATION = 4;
  const MARKER_RADIUS = 1.7;
  const MAX_PLACEMENT_ATTEMPTS = 150;
  // If every attempt above is too close, fall back to generating
  // this many more candidates and keeping whichever is furthest
  // from the nearest existing dart - a "least bad" choice rather
  // than one final arbitrary guess.
  const FALLBACK_CANDIDATE_COUNT = 40;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Converts a "clockwise degrees from 12 o'clock" angle and a
   * radius into {x, y} relative to the board center. Used by both
   * the board renderer (wedge/number positions) and dart placement,
   * so the two can never disagree about where a segment actually is.
   */
  function polarToPoint(radius, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
  }

  /** Returns the 0-based index of a segment number in SEGMENT_ORDER, or -1. */
  function segmentIndex(segmentNumber) {
    return SEGMENT_ORDER.indexOf(segmentNumber);
  }

  /**
   * Parses a throw notation ("T20", "20", "D5", "25", "50") into
   * the ring zone and segment number needed to place/draw it.
   * @param {string} notation
   * @returns {{zone: 'bullInner'|'bullOuter'|'treble'|'double'|'single', segmentNumber: number|null}}
   */
  function parseNotation(notation) {
    if (notation === '50') return { zone: 'bullInner', segmentNumber: null };
    if (notation === '25') return { zone: 'bullOuter', segmentNumber: null };
    if (notation[0] === 'T') return { zone: 'treble', segmentNumber: Number(notation.slice(1)) };
    if (notation[0] === 'D') return { zone: 'double', segmentNumber: Number(notation.slice(1)) };
    return { zone: 'single', segmentNumber: Number(notation) };
  }

  /**
   * Returns the [innerRadius, outerRadius] band (in board px) for a
   * zone. For a plain "single" hit, randomly picks the inner-single
   * or outer-single band each time (both score the same, and a real
   * single dart can land in either), so single markers aren't stuck
   * always on the same side.
   * @param {string} zone
   * @param {number} boardRadius - outer double-ring radius in px
   * @returns {[number, number]}
   */
  function radiusBandForZone(zone, boardRadius) {
    const f = RADIUS_FRACTIONS;
    switch (zone) {
      case 'bullInner':
        return [0, f.bullInner * boardRadius];
      case 'bullOuter':
        return [f.bullInner * boardRadius, f.bullOuter * boardRadius];
      case 'treble':
        return [f.trebleInner * boardRadius, f.trebleOuter * boardRadius];
      case 'double':
        return [f.doubleInner * boardRadius, f.doubleOuter * boardRadius];
      case 'single': {
        const useInner = Math.random() < 0.5;
        return useInner
          ? [f.bullOuter * boardRadius, f.trebleInner * boardRadius]
          : [f.trebleOuter * boardRadius, f.doubleInner * boardRadius];
      }
      default:
        throw new Error(`Unknown dartboard zone: ${zone}`);
    }
  }

  /**
   * Picks a random point strictly within the given segment number's
   * angular wedge (with a small inset from the dividing wires).
   * Bull zones ignore segmentNumber (they're full circles).
   */
  function randomAngleForSegment(segmentNumber) {
    const idx = segmentIndex(segmentNumber);
    if (idx === -1) throw new Error(`Unknown segment number: ${segmentNumber}`);

    const wedgeStart = idx * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
    const inset = SEGMENT_ANGLE * ANGLE_INSET_FRACTION;
    const usableSpan = SEGMENT_ANGLE - inset * 2;
    return wedgeStart + inset + Math.random() * usableSpan;
  }

  /** Generates a single random candidate point within the notation's correct zone. */
  function randomCandidatePoint(zone, segmentNumber, boardRadius) {
    const [rInner, rOuter] = radiusBandForZone(zone, boardRadius);
    const radialInset = (rOuter - rInner) * RADIUS_INSET_FRACTION;
    const radius = rInner + radialInset + Math.random() * (rOuter - rInner - radialInset * 2);

    const angleDeg =
      zone === 'bullInner' || zone === 'bullOuter' ? Math.random() * 360 : randomAngleForSegment(segmentNumber);

    return polarToPoint(radius, angleDeg);
  }

  /**
   * Computes a random, correctly-zoned board position for a throw
   * notation, retrying if it would land too close to an already-
   * placed dart. Never crosses into a neighbouring ring or segment -
   * only the position *within* the correct zone is randomized.
   *
   * If every attempt is too close (possible in the narrow treble
   * ring with 2 darts already placed there), falls back to
   * generating a further batch of candidates and keeping whichever
   * is furthest from its nearest neighbour - the 3 darts may end up
   * close together, but never fully overlapping.
   * @param {string} notation
   * @param {number} boardRadius
   * @param {{x: number, y: number}[]} existingPositions
   * @returns {{x: number, y: number}}
   */
  function computeDartPosition(notation, boardRadius, existingPositions) {
    const { zone, segmentNumber } = parseNotation(notation);

    const nearestDistance = (point) =>
      existingPositions.length === 0
        ? Infinity
        : Math.min(...existingPositions.map((p) => Math.hypot(p.x - point.x, p.y - point.y)));

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const point = randomCandidatePoint(zone, segmentNumber, boardRadius);
      if (nearestDistance(point) >= MIN_DART_SEPARATION) return point;
    }

    // Every attempt was too close - keep the least-bad of a further
    // batch rather than one arbitrary final guess.
    let best = null;
    let bestDistance = -Infinity;
    for (let i = 0; i < FALLBACK_CANDIDATE_COUNT; i++) {
      const point = randomCandidatePoint(zone, segmentNumber, boardRadius);
      const distance = nearestDistance(point);
      if (distance > bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  }

  // --- SVG board construction -------------------------------------

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  /** Builds the SVG path `d` for one ring-band wedge (a quadrilateral with two arced sides). */
  function ringSegmentPathD(rInner, rOuter, angleStartDeg, angleEndDeg) {
    const p1 = polarToPoint(rOuter, angleStartDeg);
    const p2 = polarToPoint(rOuter, angleEndDeg);
    const p3 = polarToPoint(rInner, angleEndDeg);
    const p4 = polarToPoint(rInner, angleStartDeg);
    const largeArc = angleEndDeg - angleStartDeg > 180 ? 1 : 0;

    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
      'Z',
    ].join(' ');
  }

  /**
   * Builds the full dartboard SVG and mounts it inside `container`.
   * @param {HTMLElement} container
   * @param {number} [size=320] - rendered width/height in px.
   * @returns {{svg: SVGElement, dartsLayer: SVGGElement, boardRadius: number}}
   */
  function createBoard(container, size = 320) {
    const boardRadius = 100; // internal coordinate space; scaled to `size` via viewBox
    // Generous enough to fit 2-digit numbers just outside the double
    // ring without clipping at any angle - see the "as if it were a
    // real dartboard" number ring below. (Previously too tight: the
    // old padding left under 0.25 units of margin, which real font
    // metrics can easily exceed, clipping numbers at the edge.)
    const viewBoxPad = 21;
    const half = boardRadius + viewBoxPad;

    const svg = svgEl('svg', {
      viewBox: `${-half} ${-half} ${half * 2} ${half * 2}`,
      width: size,
      height: size,
      class: 'dartboard-svg',
      role: 'img',
      'aria-label': 'Dartboard',
    });

    // Outer wire rim
    svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: boardRadius + 2, class: 'dartboard-rim' }));

    const f = RADIUS_FRACTIONS;
    const bands = [
      { key: 'outerSingle', rInner: f.trebleOuter * boardRadius, rOuter: f.doubleInner * boardRadius },
      { key: 'double', rInner: f.doubleInner * boardRadius, rOuter: f.doubleOuter * boardRadius },
      { key: 'innerSingle', rInner: f.bullOuter * boardRadius, rOuter: f.trebleInner * boardRadius },
      { key: 'treble', rInner: f.trebleInner * boardRadius, rOuter: f.trebleOuter * boardRadius },
    ];

    SEGMENT_ORDER.forEach((segmentNumber, idx) => {
      const isEven = idx % 2 === 0;
      const angleStart = idx * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
      const angleEnd = angleStart + SEGMENT_ANGLE;

      bands.forEach((band) => {
        const isRing = band.key === 'double' || band.key === 'treble';
        const colorClass = isRing
          ? isEven
            ? 'dartboard-seg--ring-a'
            : 'dartboard-seg--ring-b'
          : isEven
          ? 'dartboard-seg--single-a'
          : 'dartboard-seg--single-b';

        svg.appendChild(
          svgEl('path', {
            d: ringSegmentPathD(band.rInner, band.rOuter, angleStart, angleEnd),
            class: `dartboard-seg ${colorClass}`,
          })
        );
      });

      // Segment number, just outside the double ring, upright - like
      // the printed number ring on a real board.
      const numberPoint = polarToPoint(boardRadius + 9, idx * SEGMENT_ANGLE);
      const text = svgEl('text', {
        x: numberPoint.x,
        y: numberPoint.y,
        class: 'dartboard-number',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      });
      text.textContent = String(segmentNumber);
      svg.appendChild(text);
    });

    // Bull (outer, then inner on top)
    svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: f.bullOuter * boardRadius, class: 'dartboard-seg dartboard-bull-outer' }));
    svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: f.bullInner * boardRadius, class: 'dartboard-seg dartboard-bull-inner' }));

    // Layer for dart markers, kept separate so clearing darts never
    // touches the board itself.
    const dartsLayer = svgEl('g', { class: 'dartboard-darts-layer' });
    svg.appendChild(dartsLayer);

    container.innerHTML = '';
    container.appendChild(svg);

    return { svg, dartsLayer, boardRadius };
  }

  /**
   * Places one dart marker for the given notation, avoiding overlap
   * with any darts already in `existingPositions`. Appends the
   * marker to the board's darts layer and returns the position used
   * (so the caller can pass it back in for the next dart).
   * @param {{dartsLayer: SVGGElement, boardRadius: number}} board
   * @param {string} notation
   * @param {{x: number, y: number}[]} existingPositions
   * @returns {{x: number, y: number}}
   */
  function placeDart(board, notation, existingPositions) {
    const position = computeDartPosition(notation, board.boardRadius, existingPositions);

    const marker = svgEl('circle', {
      cx: position.x,
      cy: position.y,
      r: MARKER_RADIUS,
      class: 'dartboard-dart',
    });
    board.dartsLayer.appendChild(marker);

    return position;
  }

  /** Removes all placed dart markers, ready for a new question. */
  function clearDarts(board) {
    board.dartsLayer.innerHTML = '';
  }

  window.DartsTrainer.dartboard = {
    createBoard,
    placeDart,
    clearDarts,
    // Exposed for testing/tooling - not needed for normal use.
    _internal: { parseNotation, computeDartPosition, RADIUS_FRACTIONS, SEGMENT_ORDER, SEGMENT_ANGLE, segmentIndex },
  };
})();
