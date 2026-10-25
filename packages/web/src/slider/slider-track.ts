/*
 * Slider track geometry, ported from the AndroidX Compose Slider `drawTrack` /
 * `SliderDefaults.drawTrack` (androidx-main 1.6.0-alpha01). The math mirrors the source: each track
 * segment is a rounded rectangle with independent corner radii, the handle leaves a gap of
 * `thumb/2 + gap` from the segment it does not sit on, and the active segment is drawn from the
 * centre (centered slider), between the thumbs (range), or from the start (plain).
 *
 * Adapted from materialwebunofficial's `slider-layout.js` (Apache-2.0), which is itself a direct port
 * of the AndroidX source. Drawing (SVG) and thumb placement are kept separate.
 */

const f = Math.fround;
const lerp = (a: number, b: number, t: number): number => f(f(f(1 - t) * a) + f(t * b));

/** A rectangle with per-corner radii (order: TL, TR, BR, BL — each as [x, y]). */
export interface TrackPath {
  readonly role: "inactive" | "active";
  readonly bounds: { left: number; top: number; right: number; bottom: number };
  readonly radii: ReadonlyArray<readonly [number, number]>;
}

/** A stop / tick dot. `kind` distinguishes the fixed stop indicators from the step ticks. */
export interface TrackDot {
  readonly position: number;
  readonly role: "active" | "inactive" | "active-tick" | "inactive-tick";
  readonly kind: "stop" | "tick";
}

/** The full layout produced for a slider track. */
export interface TrackLayout {
  readonly length: number;
  readonly thickness: number;
  readonly paths: TrackPath[];
  readonly dots: TrackDot[];
  readonly valueStart: number;
  readonly valueEnd: number;
}

/** Options for {@link sliderTrackLayout}. */
export interface TrackLayoutOptions {
  length: number;
  thickness?: number;
  start?: number;
  end?: number;
  steps?: number;
  range?: boolean;
  centered?: boolean;
  vertical?: boolean;
  rtl?: boolean;
  reverse?: boolean;
  gap?: number;
  insideCorner?: number;
  corner?: number;
  shrink?: boolean;
  stopIndicators?: boolean;
  handle?: number;
}

/** The 0..1 fraction of `value` in `[min, max]`, clamped. */
export function sliderValueFraction(value: number, min: number, max: number): number {
  const span = f(f(max) - f(min));
  return span === 0 ? 0 : f(Math.max(0, Math.min(1, f(f(f(value) - f(min)) / span))));
}

/** The evenly-spaced tick fractions for `steps` interior stops (steps + 2 values, endpoints included). */
export function sliderTickFractions(steps: number): number[] {
  return steps > 0 ? Array.from({ length: steps + 2 }, (_, i) => f(i / (steps + 1))) : [];
}

/** Snaps `value` to the nearest anchor over `steps`, ties toward the lower anchor (AndroidX). */
export function snapSliderValue(value: number, min: number, max: number, steps = 0): number {
  const current = f(Math.max(min, Math.min(max, value)));
  if (!steps || max <= min) return current;
  const fraction = f(f(current - min) / f(max - min));
  const lower = Math.max(0, Math.min(steps + 1, Math.floor(fraction * (steps + 1))));
  const a = lerp(f(min), f(max), f(lower / (steps + 1)));
  const b = lerp(f(min), f(max), f(Math.min(steps + 1, lower + 1) / (steps + 1)));
  return Math.abs(f(a - current)) <= Math.abs(f(b - current)) ? a : b;
}

/** The thumb offset along the track for `fraction` (integer px), inset by `corner` when stepping. */
export function sliderThumbOffset(length: number, fraction: number, steps = 0, corner = 8): number {
  const p = f(fraction);
  return steps > 0 && p !== 0 && p !== 1
    ? Math.round(f(f(f(length - corner * 2) * p))) + corner
    : Math.round(f(length * p));
}

/**
 * Lays out a slider track, mirroring AndroidX `DrawScope.drawTrack`: the inactive/active segments
 * with independent corner radii and handle gaps, plus the stop-indicator and tick dots.
 */
export function sliderTrackLayout(options: TrackLayoutOptions): TrackLayout {
  let {
    length,
    thickness = 16,
    start = 0,
    end = 0.5,
    steps = 0,
    range = false,
    centered = false,
    vertical = false,
    rtl = false,
    reverse = false,
    gap = 6,
    insideCorner = 2,
    corner,
    shrink = centered || vertical,
    stopIndicators = true,
    handle = 4,
  } = options;

  corner = corner ?? thickness / 2;
  length = f(Math.max(0, length));
  thickness = f(thickness);
  corner = f(corner);
  insideCorner = f(insideCorner);
  start = f(start);
  end = f(end);

  const ticks = sliderTickFractions(steps);
  const rtlHorizontal = rtl && !vertical;
  const valuePosition = (p: number): number =>
    ticks.length && p !== 0 && p !== 1
      ? f(f(f(length - f(corner! * 2)) * p) + corner!)
      : f(length * p);
  const valueStart = valuePosition(start);
  const valueEnd = valuePosition(end);
  const center = f(length / 2);

  // Thumb size along the track (present on each side that holds a handle).
  const startHandle = range || (centered && end <= 0.5) ? handle : 0;
  const endHandle = !centered || end >= 0.5 ? handle : 0;
  const startGap = (range || centered) && gap > 0 ? f(startHandle / 2 + gap) : 0;
  const endGap = gap > 0 ? f(endHandle / 2 + gap) : 0;

  const paths: TrackPath[] = [];
  const dots: TrackDot[] = [];
  const axisPosition = (p: number): number => ((vertical ? reverse : rtlHorizontal) ? f(length - p) : p);

  const drawPath = (role: "inactive" | "active", from: number, to: number, first: number, last: number): void => {
    const extent = f(to - from);
    const lo = rtlHorizontal ? f(length - to) : from;
    const hi = f(lo + extent);
    if ((vertical && reverse) || rtlHorizontal) [first, last] = [last, first];
    const bounds = vertical
      ? {
          left: 0,
          top: reverse ? f(length - hi) : lo,
          right: thickness,
          bottom: reverse ? f(length - lo) : hi,
        }
      : { left: lo, top: 0, right: hi, bottom: thickness };
    const radii = (vertical ? [first, first, last, last] : [first, last, last, first]).map(
      (r) => [r, r] as [number, number],
    );
    paths.push({ role, bounds, radii });
  };
  const drawDot = (position: number, role: TrackDot["role"], kind: TrackDot["kind"]): void => {
    dots.push({ position: axisPosition(position), role, kind });
  };

  let leftThreshold = startGap;
  let rightThreshold = f(length - endGap);
  if (!shrink || ticks.length) {
    leftThreshold = f(leftThreshold + corner);
    rightThreshold = f(rightThreshold - corner);
  }
  const adjustedEnd = centered ? Math.min(valueEnd, center) : valueStart;
  const adjustedStart = centered ? Math.max(valueEnd, center) : valueEnd;

  if ((centered || range) && adjustedEnd > leftThreshold) {
    drawPath("inactive", 0, f(adjustedEnd - startGap), corner, insideCorner);
    if (stopIndicators) drawDot(corner, "active", "stop");
  }
  if (adjustedStart < rightThreshold) {
    drawPath("inactive", f(adjustedStart + endGap), length, insideCorner, corner);
    if (stopIndicators) drawDot(f(length - corner), "active", "stop");
  }

  const activeStart = centered
    ? f(adjustedEnd + (adjustedEnd < center ? startGap : 0))
    : range
      ? f(valueStart + startGap)
      : 0;
  const activeEnd = centered ? f(adjustedStart - (adjustedStart > center ? endGap : 0)) : f(valueEnd - endGap);
  const activeWidth = rtlHorizontal && !centered && !range ? activeEnd : f(activeEnd - activeStart);
  const first = centered || range ? insideCorner : corner;
  const threshold = !shrink || ticks.length ? (rtlHorizontal || centered || range ? insideCorner : corner) : 0;
  if (activeWidth > threshold) drawPath("active", activeStart, activeEnd, first, insideCorner);

  const tickStart = corner;
  const tickEnd = f(length - corner);
  const centerGap = centered ? (valueEnd > center ? startGap : endGap) : 0;
  const handleGap = centered ? (valueEnd > center ? endGap : startGap) : endGap;
  const inGap = (position: number, middle: number, size: number): boolean =>
    position >= f(middle - size) && position <= f(middle + size);
  ticks.forEach((tick, index) => {
    if (stopIndicators && (((centered || range) && index === 0) || index === ticks.length - 1)) return;
    const p = lerp(tickStart, tickEnd, tick);
    if (
      (centered && inGap(p, center, centerGap)) ||
      (range && inGap(p, valueStart, startGap)) ||
      inGap(p, valueEnd, handleGap)
    ) {
      return;
    }
    drawDot(p, p >= activeStart && p <= activeEnd ? "active-tick" : "inactive-tick", "tick");
  });

  return { length, thickness, paths, dots, valueStart, valueEnd };
}

/** Normalizes overlapping corner radii so they fit the rectangle (CSS border-radius behaviour). */
function roundedOutlineRadii(path: TrackPath): Array<[number, number]> {
  const b = path.bounds;
  const radii = path.radii.map((c) => [c[0], c[1]] as [number, number]);
  const width = f(b.right - b.left);
  const height = f(b.bottom - b.top);
  let s = 1;
  for (const [a, z, limit] of [
    [radii[3][1], radii[0][1], height],
    [radii[0][0], radii[1][0], width],
    [radii[1][1], radii[2][1], height],
    [radii[2][0], radii[3][0], width],
  ] as Array<[number, number, number]>) {
    const sum = f(a + z);
    if (sum > limit && sum !== 0) s = Math.min(s, f(limit / sum));
  }
  return radii.map((corner) => [f(corner[0] * s), f(corner[1] * s)]);
}

/** Serializes a {@link TrackPath} into an SVG path `d` with per-corner arcs. */
export function sliderTrackPath(path: TrackPath): string {
  const [tl, tr, br, bl] = roundedOutlineRadii(path).map((r) => r[0]);
  const { left: l, top: t, right: r, bottom: z } = path.bounds;
  const arc = (radius: number, x: number, y: number): string =>
    radius > 0 ? `A${radius} ${radius} 0 0 1 ${x} ${y}` : `L${x} ${y}`;
  return `M${l + tl} ${t}H${r - tr}${arc(tr, r, t + tr)}V${z - br}${arc(br, r - br, z)}H${l + bl}${arc(
    bl,
    l,
    z - bl,
  )}V${t + tl}${arc(tl, l + tl, t)}Z`;
}
