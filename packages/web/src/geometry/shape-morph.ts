/**
 * A general-purpose shape-morphing engine.
 *
 * The AndroidX Compose `Morph` / `MaterialShapes` system morphs between named shapes by pairing them
 * into equal-length lists of cubic Bézier segments and linearly interpolating their control points.
 * This module provides the same capability for the web: shapes are described as SVG path data, are
 * resampled to a fixed number of points and normalised into the unit square, then interpolated
 * point-by-point. The result can be emitted as an SVG path `d` (for an SVG element) or a CSS
 * `polygon(...)` (for `clip-path`).
 *
 * It reuses the shared spring integrator (physics/SpringSimulation) and is framework-agnostic, so both the Button (named-shape press morph) and the
 * LoadingIndicator (shape-cycle morph) can share it.
 */

import { SpringSimulation } from "../physics/SpringSimulation";

/** A point in normalised [0, 1] space. */
export interface MorphPoint {
  readonly x: number;
  readonly y: number;
}

/** A polygon as an ordered ring of normalised points. */
export type MorphPolygon = MorphPoint[];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── SVG path parsing & uniform resampling ────────────────────────────────────────────────────────

interface Segment {
  readonly sample: (t: number) => MorphPoint;
  readonly length: number;
}

function quad(p0: MorphPoint, p1: MorphPoint, p2: MorphPoint, t: number): MorphPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function cubic(p0: MorphPoint, p1: MorphPoint, p2: MorphPoint, p3: MorphPoint, t: number): MorphPoint {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Measures an approximated arc length by sampling `steps` points. */
function approxLength(sample: (t: number) => MorphPoint, steps = 24): number {
  let length = 0;
  let prev = sample(0);
  for (let i = 1; i <= steps; i++) {
    const p = sample(i / steps);
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return length;
}

function parseSegments(d: string): Segment[] {
  const tokens = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  const segments: Segment[] = [];
  let current: MorphPoint = { x: 0, y: 0 };
  let start: MorphPoint = { x: 0, y: 0 };

  const addLine = (to: MorphPoint): void => {
    const from = current;
    segments.push({
      sample: (t) => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }),
      length: Math.hypot(to.x - from.x, to.y - from.y),
    });
    current = to;
  };

  for (const token of tokens) {
    const type = token[0];
    const nums = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (type === "M") {
      current = { x: nums[0], y: nums[1] };
      start = current;
    } else if (type === "L") {
      addLine({ x: nums[0], y: nums[1] });
    } else if (type === "H") {
      addLine({ x: nums[0], y: current.y });
    } else if (type === "V") {
      addLine({ x: current.x, y: nums[0] });
    } else if (type === "Q") {
      const p1 = { x: nums[0], y: nums[1] };
      const p2 = { x: nums[2], y: nums[3] };
      const from = current;
      segments.push({ sample: (t) => quad(from, p1, p2, t), length: approxLength((t) => quad(from, p1, p2, t)) });
      current = p2;
    } else if (type === "C") {
      const p1 = { x: nums[0], y: nums[1] };
      const p2 = { x: nums[2], y: nums[3] };
      const p3 = { x: nums[4], y: nums[5] };
      const from = current;
      segments.push({
        sample: (t) => cubic(from, p1, p2, p3, t),
        length: approxLength((t) => cubic(from, p1, p2, p3, t)),
      });
      current = p3;
    } else if (type === "Z" || type === "z") {
      addLine(start);
    }
  }
  return segments;
}

/**
 * Resamples an SVG path into `count` points spaced uniformly by arc length (starting at the path
 * origin). The closing `Z` edge is included so the ring is complete.
 */
export function sampleSvgPath(d: string, count: number): MorphPolygon {
  const segments = parseSegments(d);
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  if (segments.length === 0 || total === 0) return [];

  const step = total / count;
  const points: MorphPolygon = [];
  let segIndex = 0;
  let segStart = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (segIndex < segments.length - 1 && segStart + segments[segIndex].length < target) {
      segStart += segments[segIndex].length;
      segIndex++;
    }
    const seg = segments[segIndex];
    const t = seg.length > 0 ? clamp01((target - segStart) / seg.length) : 0;
    points.push(seg.sample(t));
  }
  return points;
}

// ── Normalisation & alignment ────────────────────────────────────────────────────────────────────

/** Normalises a polygon into the unit square (uniform scale, centred) so shapes overlay exactly. */
export function normalizePolygon(points: MorphPolygon): MorphPolygon {
  if (points.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const scale = Math.max(maxX - minX, maxY - minY) || 1;
  const w = (maxX - minX) / scale;
  const h = (maxY - minY) / scale;
  const ox = (1 - w) / 2;
  const oy = (1 - h) / 2;
  return points.map((p) => ({ x: (p.x - minX) / scale + ox, y: (p.y - minY) / scale + oy }));
}

function signedArea(points: MorphPolygon): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function rotate(points: MorphPolygon, offset: number): MorphPolygon {
  const n = points.length;
  const out = new Array<MorphPoint>(n);
  for (let i = 0; i < n; i++) out[i] = points[(i + offset) % n];
  return out;
}

/** The circular shift that best aligns `source` onto `target` (minimises summed squared distance). */
function bestShift(target: MorphPolygon, source: MorphPolygon): number {
  const n = Math.min(target.length, source.length);
  let bestK = 0;
  let bestScore = Infinity;
  for (let k = 0; k < n; k++) {
    let score = 0;
    for (let i = 0; i < n; i++) {
      const s = source[(i + k) % n];
      const t = target[i];
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      score += dx * dx + dy * dy;
      if (score >= bestScore) break;
    }
    if (score < bestScore) {
      bestScore = score;
      bestK = k;
    }
  }
  return bestK;
}

/**
 * Aligns `points` to `reference` so morphing corresponds vertex-to-vertex: matching winding direction
 * and applying the best circular shift.
 */
export function alignPolygon(reference: MorphPolygon, points: MorphPolygon): MorphPolygon {
  const refSign = Math.sign(signedArea(reference));
  const sign = Math.sign(signedArea(points));
  const oriented = sign !== 0 && sign !== refSign ? points.slice().reverse() : points;
  return rotate(oriented, bestShift(reference, oriented));
}

// ── Interpolation & serialisation ──────────────────────────────────────────────────────────────

/** Linear interpolation between two aligned polygons of equal length. */
export function morphPolygon(from: MorphPolygon, to: MorphPolygon, t: number): MorphPolygon {
  const n = Math.min(from.length, to.length);
  const out = new Array<MorphPoint>(n);
  for (let i = 0; i < n; i++) {
    out[i] = { x: lerp(from[i].x, to[i].x, t), y: lerp(from[i].y, to[i].y, t) };
  }
  return out;
}

/** Emits a CSS `polygon(x% y%, …)` for `clip-path`. */
export function polygonToClipPath(points: MorphPolygon): string {
  const coords = points.map((p) => `${(p.x * 100).toFixed(3)}% ${(p.y * 100).toFixed(3)}%`);
  return `polygon(${coords.join(", ")})`;
}

/** Emits an SVG path `d` for a closed polygon, scaled to a `size`-by-`size` box. */
export function polygonToSvgPath(points: MorphPolygon, size = 1): string {
  if (points.length === 0) return "";
  const s = (p: MorphPoint): string => `${(p.x * size).toFixed(3)} ${(p.y * size).toFixed(3)}`;
  let d = `M ${s(points[0])}`;
  for (let i = 1; i < points.length; i++) d += ` L ${s(points[i])}`;
  return `${d} Z`;
}

/**
 * Preprocesses a list of SVG path shapes into a morph-ready sequence: every shape is resampled to the
 * same point count, normalised to the unit square, and aligned to the first shape so adjacent morphs
 * correspond vertex-to-vertex.
 *
 * @param paths The SVG path data for each shape, in morph order.
 * @param samples The number of points each shape is resampled to.
 * @returns The aligned polygons.
 */
export function prepareMorphShapes(paths: readonly string[], samples = 300): MorphPolygon[] {
  const base = paths.map((d) => normalizePolygon(sampleSvgPath(d, samples)));
  if (base.length === 0) return [];
  const reference = base[0];
  return base.map((poly) => (poly === reference ? poly : alignPolygon(reference, poly)));
}

// ── rAF-driven morph sequence ───────────────────────────────────────────────────────────────────

/** Options for {@link ShapeMorphSequence}. */
export interface ShapeMorphSequenceOptions {
  /** Aligned polygons to cycle through, in order (from {@link prepareMorphShapes}). */
  readonly shapes: readonly MorphPolygon[];
  /** Duration of each shape-to-shape transition (morph step interval), in milliseconds. */
  readonly durationMs: number;
  /** Called every animation frame with the current clip-path polygon and cumulative rotation. */
  readonly onFrame: (clipPath: string, rotation: number) => void;
  /** When true (default) the last shape morphs back into the first, looping forever. */
  readonly loop?: boolean;
  /** Degrees added to the rotation per completed morph step (AndroidX quarter-turn default 90). */
  readonly stepRotation?: number;
  /** Duration of one full continuous global rotation, in milliseconds (AndroidX 4666). */
  readonly globalRotationMs?: number;
  /** Called when a non-looping sequence finishes. */
  readonly onComplete?: () => void;
}

/** Default morph spring, matching AndroidX LoadingIndicator (low-damping, quick settle). */
const MORPH_SPRING = { dampingRatio: 0.6, stiffness: 200 } as const;

/**
 * Drives the indeterminate shape morph the same way AndroidX Compose `LoadingIndicator` does:
 *
 * - A **spring** (dampingRatio 0.6 / stiffness 200) animates the morph progress from 0 → 1 for the
 *   current shape pair. Each "step" is retriggered every `intervalMs`; when the spring has settled
 *   the progress snaps back to 0 and the pair advances (index++), adding `stepDegrees` (90°) to a
 *   *relative* rotation (mod 360°).
 * - A **separate, continuous** global rotation advances 360° over `globalRotationMs` (linear,
 *   looping) — independent of the morph steps.
 * - The rendered rotation is `globalRotation + stepRotation`, so the indicator turns smoothly while
 *   each morph adds a quarter-turn.
 *
 * `onFrame` receives the current `clip-path` polygon and the combined rotation in degrees.
 */
export class ShapeMorphSequence {
  readonly #shapes: readonly MorphPolygon[];
  readonly #interval: number;
  readonly #stepDegrees: number;
  readonly #globalRotationMs: number;
  readonly #onFrame: (clipPath: string, rotation: number) => void;
  readonly #loop: boolean;
  readonly #onComplete?: () => void;

  /** Spring that drives morph progress (0..1) for the current pair. */
  #spring = new SpringSimulation({ ...MORPH_SPRING });

  #raf = 0;
  #lastTime = 0;
  /** Time since the current morph step began (ms). */
  #stepElapsed = 0;
  /** Total elapsed animation time (ms), for the continuous global rotation. */
  #elapsed = 0;
  #index = 0;
  /** Accumulated per-step rotation in degrees (0..360). */
  #stepRotation = 0;
  #running = false;
  #paused = false;

  constructor(options: ShapeMorphSequenceOptions) {
    this.#shapes = options.shapes;
    this.#interval = Math.max(1, options.durationMs);
    this.#stepDegrees = options.stepRotation ?? 90;
    this.#globalRotationMs = options.globalRotationMs ?? 4666;
    this.#onFrame = options.onFrame;
    this.#loop = options.loop ?? true;
    this.#onComplete = options.onComplete;
  }

  /** Whether the sequence is currently animating. */
  get isRunning(): boolean {
    return this.#running;
  }

  /** Starts (or restarts) the sequence from the first shape. @returns {void} */
  start(): void {
    this.stop();
    if (this.#shapes.length < 2) return;
    this.#running = true;
    this.#paused = false;
    this.#index = 0;
    this.#stepRotation = 0;
    this.#stepElapsed = 0;
    this.#elapsed = 0;
    this.#lastTime = 0;
    this.#spring = new SpringSimulation({ ...MORPH_SPRING });
    this.#spring.setValue(0);
    this.#spring.setTarget(1);
    this.#render(0);
    this.#raf = requestAnimationFrame(this.#tick);
  }

  /** Stops the sequence without firing onComplete. @returns {void} */
  stop(): void {
    this.#running = false;
    this.#paused = false;
    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }
  }

  /** Pauses the sequence, keeping the current frame. @returns {void} */
  pause(): void {
    if (!this.#running || this.#paused) return;
    this.#paused = true;
  }

  /** Resumes a paused sequence where it left off. @returns {void} */
  resume(): void {
    if (!this.#running || !this.#paused) return;
    this.#paused = false;
    this.#lastTime = 0;
    this.#raf = requestAnimationFrame(this.#tick);
  }

  /** @private */
  readonly #tick = (time: number): void => {
    if (!this.#running || this.#paused) return;
    const dt = this.#lastTime === 0 ? 16.7 : time - this.#lastTime;
    this.#lastTime = time;
    this.#elapsed += dt;
    this.#stepElapsed += dt;

    // Advance the morph spring one frame (clamped to the pair's progress 0..1).
    const frame = this.#spring.step(dt);

    // A step lasts `interval` ms; when it elapses, advance the pair and restart progress (snap 0).
    if (this.#stepElapsed >= this.#interval) {
      this.#stepElapsed -= this.#interval;
      this.#index = (this.#index + 1) % this.#shapes.length;
      this.#stepRotation = (this.#stepRotation + this.#stepDegrees) % 360;
      this.#spring = new SpringSimulation({ ...MORPH_SPRING });
      this.#spring.setValue(0);
      this.#spring.setTarget(1);
      if (!this.#loop && this.#index === this.#shapes.length - 1) {
        this.#render(0);
        this.#running = false;
        this.#onComplete?.();
        return;
      }
    }

    this.#render(Math.min(1, Math.max(0, frame.value)));
    this.#raf = requestAnimationFrame(this.#tick);
  };

  /**
   * Renders the frame for the given morph progress (0..1) of the current pair.
   * @private
   */
  #render(progress: number): void {
    const n = this.#shapes.length;
    const from = this.#shapes[this.#index];
    const to = this.#shapes[(this.#index + 1) % n];
    const clipPath = polygonToClipPath(morphPolygon(from, to, progress));
    const globalRotation = (this.#elapsed / this.#globalRotationMs) * 360;
    this.#onFrame(clipPath, globalRotation + this.#stepRotation);
  }
}

