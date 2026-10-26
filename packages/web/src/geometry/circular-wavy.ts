/**
 * Circular wavy progress geometry — clean-room implementation derived from the behaviour of
 * AndroidX Material3 `CircularWavyProgressIndicator` (expressive).
 *
 * Shape model: the active segment is a **rounded star** (alternating outer/inner radius vertices,
 * each corner replaced by a circular arc), the track is a plain circle. The star is sampled to
 * `[angle, radius]` polar points, and morphing circle<->star is a radial interpolation at the same
 * angle (`r = (1-a)*R + a*rho`). The active path is drawn by walking this closed loop twice,
 * trimming an arc-length window, then rotating by `-offset*360°` so the wave appears to travel.
 *
 * Everything is stroked (never filled as a band), so the visible line width is constant by
 * construction. Coordinates normalise to a `size - stroke` box, matching the native `normalized()`.
 */

/** One corner-arc sample in polar form: angle (radians, 0..2π) and radius (normalised ~0..0.5). */
type PolarSample = readonly [angle: number, radius: number];

/** A point on the (pixel-space) outline. */
export type Point = readonly [x: number, y: number];

/** Star rounding parameters (Material defaults for the circular wavy star). */
const STAR_INNER_RADIUS = 0.75;
const STAR_OUTER_ROUND = 0.35;
const STAR_INNER_ROUND = 0.5;
/** Samples per corner arc — higher gives smoother rounded corners. */
const ARC_SAMPLES = 16;

/**
 * Build the rounded star as normalised polar samples `[θ, ρ]`, θ sorted ascending and monotonic.
 * Each of the `2n` vertices (n outer at radius 1, n inner at `inner`) is rounded by a circular arc of
 * the given corner radius; the arc is sampled into points, then the whole outline is normalised to a
 * unit bounding box (max extent → 0.5).
 */
export function roundedStarSamples(n: number): PolarSample[] {
  const vertices: { x: number; y: number; round: number }[] = [];
  for (let k = 0; k < 2 * n; k++) {
    const a = (k * Math.PI) / n;
    const r = k % 2 ? STAR_INNER_RADIUS : 1;
    vertices.push({ x: r * Math.cos(a), y: r * Math.sin(a), round: k % 2 ? STAR_INNER_ROUND : STAR_OUTER_ROUND });
  }
  const m = vertices.length;
  const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x - b.x, y: a.y - b.y });
  const len = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
  const nrm = (v: { x: number; y: number }) => {
    const l = len(v);
    return { x: v.x / l, y: v.y / l };
  };
  // Desired cut distance at each vertex and the interior half-angle geometry.
  const info = vertices.map((v, i) => {
    const p = vertices[(i - 1 + m) % m];
    const q = vertices[(i + 1) % m];
    const d1 = nrm(sub(p, v));
    const d2 = nrm(sub(q, v));
    const alpha = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    return { d1, d2, alpha, cut: v.round / Math.tan(alpha / 2) };
  });
  // Scale each side down if the two corner cuts would overrun it.
  const sideScale = vertices.map((v, i) => {
    const j = (i + 1) % m;
    const L = len(sub(vertices[j], v));
    const s = info[i].cut + info[j].cut;
    return s > L ? L / s : 1;
  });
  const pts: { x: number; y: number }[] = [];
  vertices.forEach((v, i) => {
    const f = Math.min(sideScale[i], sideScale[(i - 1 + m) % m]);
    const { d1, d2, alpha } = info[i];
    const cut = info[i].cut * f;
    const r = cut * Math.tan(alpha / 2);
    const bis = nrm({ x: d1.x + d2.x, y: d1.y + d2.y });
    const c = { x: v.x + bis.x * (r / Math.sin(alpha / 2)), y: v.y + bis.y * (r / Math.sin(alpha / 2)) };
    const t1 = { x: v.x + d1.x * cut, y: v.y + d1.y * cut };
    const t2 = { x: v.x + d2.x * cut, y: v.y + d2.y * cut };
    const a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
    const a2 = Math.atan2(t2.y - c.y, t2.x - c.x);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let s = 0; s <= ARC_SAMPLES; s++) {
      const a = a1 + (da * s) / ARC_SAMPLES;
      pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
  });
  // Convert to polar, ensuring angles are monotonic 0..2π (the star is star-shaped about centre).
  let samples: [number, number][] = pts.map((p) => [Math.atan2(p.y, p.x), Math.hypot(p.x, p.y)]);
  for (const s of samples) if (s[0] < -1e-9) s[0] += 2 * Math.PI;
  samples.sort((a, b) => a[0] - b[0]);
  // Normalise by bounding box (max extent → 0.5).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale = 1 / Math.max(maxX - minX, maxY - minY);
  samples = samples.map(([t, r]) => [t, r * scale]);
  return samples;
}

/** Vertex count for a given pixel geometry: `max(5, round(2π·r / wavelength))`. */
export function circularVertexCount(size: number, stroke: number, wavelength: number): number {
  const r = size / 2 - stroke / 2;
  return Math.max(5, Math.round((2 * Math.PI * r) / wavelength));
}

/** Geometry options for {@link generateCircularWavyPath}. */
export interface CircularWavyOptions {
  /** Outer box size in px. */
  size: number;
  /** Active stroke width in px. */
  stroke: number;
  /** Track stroke width in px. */
  trackStroke: number;
  /** Gap between active and track in px. */
  gap: number;
  /** Wavelength in px. */
  wavelength: number;
}

/** Result: `d` strings for the active wave and the track, plus vertex count and arc lengths. */
export interface CircularWavyPaths {
  active: string;
  track: string;
  /** Vertex count used (for wave-speed timing). */
  vertexCount: number;
  /** Active path length in px (one loop). */
  activeLength: number;
  /** Track circle length in px. */
  trackLength: number;
}

/**
 * Build the (sub-pixel) outline points of one loop of the circular wavy shape, in pixel space, at the
 * given morph amplitude (0 = circle, 1 = star), rotated so the first vertex sits at 12 o'clock.
 */
function loopPoints(star: readonly PolarSample[], amplitude: number, size: number, stroke: number): Point[] {
  const c = size / 2;
  const S = size - stroke;
  const out: Point[] = [];
  for (const [th, rho] of star) {
    const r = ((1 - amplitude) * 0.5 + amplitude * rho) * S;
    const ang = th - Math.PI / 2; // put first vertex at 12 o'clock
    out.push([c + r * Math.cos(ang), c + r * Math.sin(ang)]);
  }
  return out;
}

/**
 * Generate the circular wavy progress paths.
 *
 * @param progress fraction 0..1 of the arc to fill (determinate).
 * @param morphAmplitude 0..1 morph between circle (0) and star (1). Determinate amplitude is driven by
 *   the caller (default: 0 outside 10%..95%).
 * @param options pixel geometry.
 * @param waveOffset 0..1 phase of the travelling wave (0 for a static frame).
 * @param rotationDeg extra whole-shape rotation in degrees (used by the indeterminate animation).
 */
export function generateCircularWavyPath(
  progress: number,
  morphAmplitude: number,
  options: CircularWavyOptions,
  waveOffset = 0,
  rotationDeg = 0,
  starCache?: Map<number, PolarSample[]>,
): CircularWavyPaths {
  const { size, stroke, trackStroke, gap, wavelength } = options;
  const n = circularVertexCount(size, stroke, wavelength);
  let star: PolarSample[];
  if (starCache?.has(n)) {
    star = starCache.get(n)!;
  } else {
    star = roundedStarSamples(n);
    starCache?.set(n, star);
  }

  const c = size / 2;
  const endP = Math.min(1, Math.max(0, progress));
  const clampAmp = Math.min(1, Math.max(0, morphAmplitude));

  // Densify into two loops (+ closing point) so the arc-length window can wrap seamlessly.
  const loop = loopPoints(star, clampAmp, size, stroke);
  const pts: Point[] = loop.concat(loop, [loop[0]]);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const L = cum[cum.length - 1] / 2; // one loop length

  const pStop = endP * L;
  const offset = clampAmp > 0 ? waveOffset : 0;
  const shift = offset * L;
  const at = (d: number): [number, number, number, number] => {
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const f = (d - cum[lo]) / span;
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f, lo, hi];
  };
  const rot = ((-offset * 360 + rotationDeg) * Math.PI) / 180;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const R = (p: Point): Point => [c + (p[0] - c) * cs - (p[1] - c) * sn, c + (p[0] - c) * sn + (p[1] - c) * cs];

  let active = "";
  if (pStop > 0.01) {
    const a = at(shift);
    const b = at(shift + pStop);
    const seg: Point[] = [[a[0], a[1]]];
    for (let i = a[2]; i <= b[2]; i++) seg.push(pts[i]);
    seg.push([b[0], b[1]]);
    active = seg
      .map((p, i) => {
        const [x, y] = R(p);
        return `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
      })
      .join("");
  }

  // Track: plain circle from 12 o'clock, affected by rotationDeg but not by waveOffset.
  const Rt = (size - stroke) / 2;
  const Lt = 2 * Math.PI * Rt;
  const cap = Math.max(stroke, trackStroke) / 2;
  const spacing = 2 * Math.min(pStop, cap) + Math.min(pStop, gap);
  const tStart = endP * Lt + spacing;
  const tStop = Lt - spacing;
  let track = "";
  if (tStop - tStart > 0.01) {
    const base = -Math.PI / 2 + (rotationDeg * Math.PI) / 180;
    const a0 = base + tStart / Rt;
    const a1 = base + tStop / Rt;
    const sw = a1 - a0;
    if (sw >= 2 * Math.PI - 1e-4) {
      track = `M${c - Rt} ${c}a${Rt} ${Rt} 0 1 1 ${2 * Rt} 0a${Rt} ${Rt} 0 1 1 ${-2 * Rt} 0`;
    } else {
      track =
        `M${(c + Rt * Math.cos(a0)).toFixed(3)} ${(c + Rt * Math.sin(a0)).toFixed(3)}` +
        `A${Rt} ${Rt} 0 ${sw > Math.PI ? 1 : 0} 1 ${(c + Rt * Math.cos(a1)).toFixed(3)} ${(c + Rt * Math.sin(a1)).toFixed(3)}`;
    }
  }

  return { active, track, vertexCount: n, activeLength: L, trackLength: Lt };
}

// ── Easing (Material motion curves) ──────────────────────────────────────────────────────────────

/** Cubic-bezier easing evaluator. */
export function cubicBezierEasing(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number): number => ((ay * t + by) * t + cy) * t;
  const dx = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    if (Math.abs(sx(t) - x) > 1e-5) {
      t = x;
      while (hi - lo > 1e-6) {
        if (sx(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
}

/** Standard easing (rising amplitude / sweep return). */
export const easeStandard = cubicBezierEasing(0.2, 0, 0, 1);
/** EmphasizedAccelerate easing (falling amplitude). */
export const easeEmphasizedAccelerate = cubicBezierEasing(0.3, 0, 0.8, 0.15);

/** The determinate amplitude policy: waves are flat unless progress is strictly within 10%..95%. */
export function determinateAmplitude(progress: number): number {
  return progress <= 0.1 || progress >= 0.95 ? 0 : 1;
}

// ── Indeterminate animation model (6000 ms loop) ────────────────────────────────────────────────

/** Indeterminate timing constants (AndroidX `CircularAnimationProgressDuration` etc.). */
export const INDETERMINATE_DURATION_MS = 6000;
const ADDITIONAL_ROTATION_STEP_MS = 1500;
const ADDITIONAL_ROTATION_RAMP_MS = 300;

/** State of the indeterminate animation at a given time (ms). */
export interface IndeterminateState {
  /** Arc fraction to draw (0.1 .. 0.87). */
  sweep: number;
  /** Total rotation in degrees (global + additional + 90). */
  rotationDeg: number;
  /** Fixed amplitude (always 1). */
  amplitude: number;
}

/**
 * Compute the indeterminate animation state at `timeMs`. Matches AndroidX: a global rotation of
 * 1080° over 6 s, an additional +90° added every 1.5 s (300 ms linear ramp), and a sweep that grows
 * 0.1→0.87 over the first 3 s then eases back to 0.1 by 6 s.
 */
export function indeterminateState(timeMs: number): IndeterminateState {
  const t = ((timeMs % INDETERMINATE_DURATION_MS) + INDETERMINATE_DURATION_MS) % INDETERMINATE_DURATION_MS;
  const global = ((timeMs / INDETERMINATE_DURATION_MS) * 1080) % 360;
  let additional: number;
  if (t < ADDITIONAL_ROTATION_RAMP_MS) {
    additional = 90 * (t / ADDITIONAL_ROTATION_RAMP_MS);
  } else if (t < ADDITIONAL_ROTATION_STEP_MS) {
    additional = 90;
  } else if (t < ADDITIONAL_ROTATION_STEP_MS + ADDITIONAL_ROTATION_RAMP_MS) {
    additional = 90 + 90 * ((t - ADDITIONAL_ROTATION_STEP_MS) / ADDITIONAL_ROTATION_RAMP_MS);
  } else if (t < 2 * ADDITIONAL_ROTATION_STEP_MS) {
    additional = 180;
  } else if (t < 2 * ADDITIONAL_ROTATION_STEP_MS + ADDITIONAL_ROTATION_RAMP_MS) {
    additional = 180 + 90 * ((t - 2 * ADDITIONAL_ROTATION_STEP_MS) / ADDITIONAL_ROTATION_RAMP_MS);
  } else if (t < 3 * ADDITIONAL_ROTATION_STEP_MS) {
    additional = 270;
  } else if (t < 3 * ADDITIONAL_ROTATION_STEP_MS + ADDITIONAL_ROTATION_RAMP_MS) {
    additional = 270 + 90 * ((t - 3 * ADDITIONAL_ROTATION_STEP_MS) / ADDITIONAL_ROTATION_RAMP_MS);
  } else {
    additional = 360;
  }
  const sweep = t < 3000 ? 0.1 + 0.77 * (t / 3000) : 0.87 - 0.77 * easeStandard((t - 3000) / 3000);
  return { sweep, rotationDeg: global + additional + 90, amplitude: 1 };
}
