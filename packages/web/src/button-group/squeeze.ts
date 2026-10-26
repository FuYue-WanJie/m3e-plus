/**
 * Button-group press squeeze layout — pure helpers for the AndroidX "enlarge on press" behaviour.
 *
 * When one item is pressed it grows by `expandedRatio * itsOwnWidth` and borrows that space from its
 * neighbours (which shrink, bounded by `compressionLimit`). Total width is conserved. Boundary items
 * only compress one neighbour (the inner side); middle items compress both.
 *
 * This is the width-based model (works for content-sized groups where there is no distributable free
 * space). See the worklog for the layout-mode discussion.
 */

/** Geometry of one item, in px. */
export interface SqueezeItem {
  /** Current (measured) width in px. */
  width: number;
  /** Maximum px this item may be compressed by (its compressionLimit). */
  compressionLimit: number;
}

/**
 * Full-group squeeze from base ("natural") widths and per-item press progress values, matching the
 * AndroidX measure pass: iterate every item whose progress > 0 and borrow its growth from neighbours.
 * This generalises {@link squeezeWidths} to multiple simultaneously-animating presses (e.g. quick
 * re-taps where two springs overlap). Only writes the resulting widths — the caller must not read
 * layout while iterating.
 *
 * @param naturalWidths base width of each item in px (content-sized, measured at rest).
 * @param progresses per-item press progress 0..1 (spring values).
 * @param limits per-item compressionLimit in px.
 * @param expandedRatio fraction of the pressed item's own width it may grow to (AndroidX 0.15).
 */
export function squeezeLayout(
  naturalWidths: readonly number[],
  progresses: readonly number[],
  limits: readonly number[],
  expandedRatio: number,
): number[] {
  const n = naturalWidths.length;
  const w = naturalWidths.slice();
  if (n < 2) return w;
  for (let i = 0; i < n; i++) {
    const p = progresses[i];
    if (!p || p <= 0) continue;
    const own = naturalWidths[i];
    let grow = 0;
    if (i > 0 && i < n - 1) {
      const g = p * Math.min((expandedRatio * own) / 2, limits[i - 1], limits[i + 1]);
      const gl = Math.min(g, w[i - 1]);
      const gr = Math.min(g, w[i + 1]);
      w[i - 1] -= gl;
      w[i + 1] -= gr;
      grow = gl + gr;
    } else if (i === 0) {
      const g = Math.min(p * Math.min(expandedRatio * own, limits[1]), w[1]);
      w[1] -= g;
      grow = g;
    } else {
      const g = Math.min(p * Math.min(expandedRatio * own, limits[i - 1]), w[i - 1]);
      w[i - 1] -= g;
      grow = g;
    }
    w[i] += grow;
  }
  return w.map((v) => Math.max(0, v));
}

/** Result: the target widths of every item after applying one pressed item at full expansion. */
export interface SqueezeResult {
  widths: number[];
  /** Actual total growth applied to the pressed item (may be truncated by neighbour limits). */
  pressedGrowth: number;
  /** Sum of the (untruncated) desired growth, for diagnostics. */
  desiredGrowth: number;
  /** Whether the pressed growth was clipped by a neighbour's compression limit. */
  truncated: boolean;
}

/**
 * Compute the target widths for a press at `pressedIndex` with expansion progress `progress` (0..1,
 * usually the spring value). Widths are measured current widths. Total is conserved: whatever the
 * pressed item gains, its neighbour(s) lose.
 *
 * @param items current item widths + per-item compression limits (px).
 * @param pressedIndex which item is pressed.
 * @param expandedRatio fraction of the pressed item's own width it may grow to (AndroidX 0.15).
 * @param progress 0..1 how far into the press we are (spring value). Growth scales by this.
 */
export function squeezeWidths(
  items: readonly SqueezeItem[],
  pressedIndex: number,
  expandedRatio: number,
  progress: number,
): SqueezeResult {
  const n = items.length;
  const widths = items.map((it) => it.width);
  if (n < 2 || pressedIndex < 0 || pressedIndex >= n || progress <= 0) {
    return { widths, pressedGrowth: 0, desiredGrowth: 0, truncated: false };
  }
  const p = Math.min(1, Math.max(0, progress));
  const idx = pressedIndex;
  const own = items[idx].width;

  if (idx > 0 && idx < n - 1) {
    // Middle: compress both neighbours. AndroidX uses ratio*width/2 as the per-side target.
    const targetPerSide = p * ((expandedRatio * own) / 2);
    const availLeft = Math.min(targetPerSide, items[idx - 1].compressionLimit);
    const availRight = Math.min(targetPerSide, items[idx + 1].compressionLimit);
    // Also can't compress a neighbour below zero (and not more than it has).
    const growthLeft = Math.max(0, Math.min(availLeft, items[idx - 1].width));
    const growthRight = Math.max(0, Math.min(availRight, items[idx + 1].width));
    widths[idx - 1] -= growthLeft;
    widths[idx + 1] -= growthRight;
    widths[idx] += growthLeft + growthRight;
    const desired = 2 * targetPerSide;
    return {
      widths,
      pressedGrowth: growthLeft + growthRight,
      desiredGrowth: desired,
      truncated: Math.abs(growthLeft - targetPerSide) > 1e-3 || Math.abs(growthRight - targetPerSide) > 1e-3,
    };
  }

  // Boundary: compress one inner neighbour. AndroidX uses ratio*width (full) for boundary items.
  const target = p * (expandedRatio * own);
  const neighbourIndex = idx === 0 ? 1 : n - 2;
  const avail = Math.min(target, items[neighbourIndex].compressionLimit);
  const growth = Math.max(0, Math.min(avail, items[neighbourIndex].width));
  widths[neighbourIndex] -= growth;
  widths[idx] += growth;
  return {
    widths,
    pressedGrowth: growth,
    desiredGrowth: target,
    truncated: Math.abs(growth - target) > 1e-3,
  };
}

/**
 * Resolve the compression limit (px) for an item, preferring an explicit value, else a CSS token,
 * else a computed-style padding fallback. Kept pure-ish: caller supplies the resolved candidates.
 */
export function resolveCompressionLimit(
  explicitPx: number | null,
  tokenPx: number | null,
  styleFallbackPx: number,
): number {
  if (explicitPx != null && Number.isFinite(explicitPx) && explicitPx >= 0) return explicitPx;
  if (tokenPx != null && Number.isFinite(tokenPx) && tokenPx >= 0) return tokenPx;
  return Math.max(0, styleFallbackPx);
}

// ── Corner shape morph (connected / standard press) ─────────────────────────────────────────────

/** Four corner radii in px, order [topStart, topEnd, bottomStart, bottomEnd]. Infinity = full (h/2). */
export type Corners = readonly [number, number, number, number];

/**
 * Connected button-group corner shape, matching `ButtonGroupDefaults.connected*ButtonShapes`.
 * Priority: pressed > checked > default. Outer corners are full (Infinity), inner corners are
 * `inner` (default) or `innerPressed` when pressed.
 *
 * @param index item position in the group.
 * @param count total items.
 * @param pressed whether the item is currently pressed.
 * @param checked whether the item is checked/selected (single- or multi-select).
 * @param inner inner corner radius in px (CornerValueSmall; 8 at small size).
 * @param innerPressed pressed inner corner radius in px (CornerValueExtraSmall; 4).
 */
export function connectedShape(
  index: number,
  count: number,
  pressed: boolean,
  checked: boolean,
  inner = 8,
  innerPressed = 4,
): Corners {
  const FULL = Infinity;
  if (pressed) {
    if (count === 1) return [FULL, FULL, FULL, FULL];
    if (index === 0) return [FULL, innerPressed, FULL, innerPressed];
    if (index === count - 1) return [innerPressed, FULL, innerPressed, FULL];
    return [innerPressed, innerPressed, innerPressed, innerPressed];
  }
  if (checked) return [FULL, FULL, FULL, FULL]; // connectedButtonCheckedShape = CornerFull
  if (count === 1) return [FULL, FULL, FULL, FULL];
  if (index === 0) return [FULL, inner, FULL, inner];
  if (index === count - 1) return [inner, FULL, inner, FULL];
  return [inner, inner, inner, inner];
}

/** Standard (non-connected) button press corner: all four corners go to `pressed` (px), else full. */
export function standardPressShape(pressed: boolean, pressedRadius: number): Corners {
  return pressed ? [pressedRadius, pressedRadius, pressedRadius, pressedRadius] : [Infinity, Infinity, Infinity, Infinity];
}

/** Linearly interpolate two corner sets at progress p (0..1), clamping Infinity to `half`. */
export function lerpCorners(from: Corners, to: Corners, p: number, halfHeight: number): Corners {
  const t = Math.min(1, Math.max(0, p));
  return from.map((f, i) => {
    const a = Math.min(f, halfHeight);
    const b = Math.min(to[i], halfHeight);
    return a + (b - a) * t;
  }) as unknown as Corners;
}
