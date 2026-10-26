/**
 * Classic (flat) linear/circular progress geometry, ported from AndroidX Material3
 * `ProgressIndicator.kt` (`drawLinearIndicator`, `drawStopIndicator`, `drawCircularIndicator`).
 *
 * These are pure functions returning plain spans / arc angles so the element just maps them to
 * SVG. Determinate linear uses rounded-cap insets + a `gapSize + strokeWidth` gap when caps are
 * round; indeterminate linear uses the four-fraction chase with three track segments; circular uses
 * arcs with a `gapSize + strokeWidth` angular gap.
 */

/** A horizontal span in px. */
export type Span = readonly [start: number, end: number];

/** Stop-indicator box. */
export interface StopBox {
  x: number;
  y: number;
  size: number;
  round: boolean;
}

/** Deterministic linear layout. */
export interface ClassicLinearLayout {
  /** Active (indicator) spans in px. */
  active: Span[];
  /** Track spans in px. */
  tracks: Span[];
  stop: StopBox | null;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Per-span `drawLinearIndicator`: draw one line from `startFraction`..`endFraction` (0..1). */
function linearSpan(
  startFraction: number,
  endFraction: number,
  width: number,
  strokeWidth: number,
  round: boolean,
  rtl: boolean,
): Span | null {
  const barStart = (rtl ? 1 - endFraction : startFraction) * width;
  const barEnd = (rtl ? 1 - startFraction : endFraction) * width;
  if (!round || strokeWidth >= width) {
    // Butt caps (or too tall): raw line, no inset.
    return barEnd - barStart > 0 || startFraction !== endFraction ? [barStart, barEnd] : null;
  }
  const cap = strokeWidth / 2;
  if (Math.abs(endFraction - startFraction) <= 0) return null;
  const a = clamp(barStart, cap, width - cap);
  const b = clamp(barEnd, cap, width - cap);
  return [Math.min(a, b), Math.max(a, b)];
}

/**
 * Compute the deterministic linear layout: an active span `[0, progress]`, the track after it, and
 * the stop indicator box — matching AndroidX's `LinearProgressIndicator(progress)`.
 */
export function classicLinearDeterminate(
  progress: number,
  width: number,
  height: number,
  gapSize: number,
  stopSize: number,
  round: boolean,
  rtl = false,
): ClassicLinearLayout {
  const p = clamp(progress, 0, 1);
  const strokeWidth = height;
  const adjustedGap = !round || height > width ? gapSize : gapSize + strokeWidth;
  const gapFrac = adjustedGap / width;
  const trackStart = p + Math.min(p, gapFrac);

  const active: Span[] = [];
  const tracks: Span[] = [];
  const indicator = linearSpan(0, p, width, strokeWidth, round, rtl);
  if (indicator) active.push(indicator);
  if (trackStart <= 1) {
    const t = linearSpan(trackStart, 1, width, strokeWidth, round, rtl);
    if (t) tracks.push(t);
  }

  // Stop indicator (round cap -> circle, else square), inset from the trailing end.
  const stop = stopBox(width, height, stopSize, round, rtl);
  return { active, tracks, stop };
}

/** The stop-indicator box at the trailing end, or null if too small. */
export function stopBox(width: number, height: number, stopSize: number, round: boolean, rtl = false): StopBox | null {
  const size = Math.min(stopSize, height);
  if (size <= 0) return null;
  const maxOffset = 6; // StopIndicatorTrailingSpace = 6dp
  const offset = Math.min((height - size) / 2, maxOffset);
  const x = width - size / 2 - offset;
  return { x: rtl ? size / 2 + offset : x, y: height / 2, size, round };
}

/**
 * Compute the indeterminate linear layout from the four fractions
 * `[firstHead, firstTail, secondHead, secondTail]` (each 0..1), matching AndroidX's
 * `LinearProgressIndicator()` indeterminate body (two lines + three track segments).
 *
 * Note AndroidX passes (head, tail) with head > tail generally; here `head` is the larger end.
 */
export function classicLinearIndeterminate(
  fractions: readonly number[],
  width: number,
  height: number,
  gapSize: number,
  round: boolean,
  rtl = false,
): ClassicLinearLayout {
  const [firstHead, firstTail, secondHead, secondTail] = fractions;
  const strokeWidth = height;
  const adjustedGap = !round || height > width ? gapSize : gapSize + strokeWidth;
  const gapFrac = adjustedGap / width;

  const active: Span[] = [];
  const tracks: Span[] = [];

  // Track before line 1.
  if (firstHead < 1 - gapFrac) {
    const start = firstHead > 0 ? firstHead + gapFrac : 0;
    const s = linearSpan(start, 1, width, strokeWidth, round, rtl);
    if (s) tracks.push(s);
  }
  // Line 1.
  if (firstHead - firstTail > 0) {
    const s = linearSpan(firstTail, firstHead, width, strokeWidth, round, rtl);
    if (s) active.push(s);
  }
  // Track between lines.
  if (firstTail > gapFrac) {
    const start = secondHead > 0 ? secondHead + gapFrac : 0;
    const end = firstTail < 1 ? firstTail - gapFrac : 1;
    const s = linearSpan(start, end, width, strokeWidth, round, rtl);
    if (s) tracks.push(s);
  }
  // Line 2.
  if (secondHead - secondTail > 0) {
    const s = linearSpan(secondTail, secondHead, width, strokeWidth, round, rtl);
    if (s) active.push(s);
  }
  // Track after line 2.
  if (secondTail > gapFrac) {
    const end = secondTail < 1 ? secondTail - gapFrac : 1;
    const s = linearSpan(0, end, width, strokeWidth, round, rtl);
    if (s) tracks.push(s);
  }

  return { active, tracks, stop: null };
}

// ── Circular ────────────────────────────────────────────────────────────────────────────────────

/** A circular arc: start angle (degrees, 0 = 3 o'clock) and sweep. */
export interface Arc {
  startAngle: number;
  sweep: number;
  /** Radius in px (mid-stroke). */
  radius: number;
}

const TAU = Math.PI * 2;

/** `gapSize` angular fraction: `(adjustedGap / (π·diameter)) * 360`, adjustedGap = gap+stroke if round. */
function gapSweepDeg(gapSize: number, strokeWidth: number, diameter: number, round: boolean): number {
  const adjusted = !round ? gapSize : gapSize + strokeWidth;
  return (adjusted / (Math.PI * diameter)) * 360;
}

/** Deterministic circular arcs (active + track), matching `CircularProgressIndicator(progress)`. */
export function classicCircularDeterminate(
  progress: number,
  diameter: number,
  strokeWidth: number,
  gapSize: number,
  round: boolean,
): { active: Arc; track: Arc } {
  const p = clamp(progress, 0, 1);
  const startAngle = 270;
  const sweepDeg = p * 360;
  const radius = (diameter - strokeWidth) / 2;
  const gapDeg = gapSweepDeg(gapSize, strokeWidth, diameter, round);
  const minSweep = Math.min(sweepDeg, gapDeg);
  const track: Arc = {
    startAngle: startAngle + sweepDeg + minSweep,
    sweep: 360 - sweepDeg - minSweep * 2,
    radius,
  };
  const active: Arc = { startAngle, sweep: sweepDeg, radius };
  return { active, track };
}

/** Indeterminate circular arcs at a given sweep fraction and total rotation (degrees). */
export function classicCircularIndeterminate(
  sweepFraction: number,
  rotationDeg: number,
  diameter: number,
  strokeWidth: number,
  gapSize: number,
  round: boolean,
): { active: Arc; track: Arc } {
  const sweepDeg = clamp(sweepFraction, 0, 1) * 360;
  const radius = (diameter - strokeWidth) / 2;
  const gapDeg = gapSweepDeg(gapSize, strokeWidth, diameter, round);
  const minSweep = Math.min(sweepDeg, gapDeg);
  // rotate(global + additional) then arcs drawn from startAngle 0.
  const base = rotationDeg;
  const track: Arc = { startAngle: base + sweepDeg + minSweep, sweep: 360 - sweepDeg - minSweep * 2, radius };
  const active: Arc = { startAngle: base, sweep: sweepDeg, radius };
  return { active, track };
}

/** Serialize a line span to an SVG `d` at vertical centre `y`. */
export function spanToLine(span: Span, y: number): string {
  return `M ${span[0]} ${y} L ${span[1]} ${y}`;
}

/** Serialize an arc to an SVG `d` (a single A command). */
export function arcToPath(arc: Arc, cx: number, cy: number): string {
  if (arc.sweep <= 0) return "";
  const sweep = Math.min(arc.sweep, 359.999);
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const x0 = cx + arc.radius * Math.cos(toRad(arc.startAngle));
  const y0 = cy + arc.radius * Math.sin(toRad(arc.startAngle));
  const a1 = arc.startAngle + sweep;
  const x1 = cx + arc.radius * Math.cos(toRad(a1));
  const y1 = cy + arc.radius * Math.sin(toRad(a1));
  const large = sweep > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${arc.radius} ${arc.radius} 0 ${large} 1 ${x1} ${y1}`;
}

export { TAU };
