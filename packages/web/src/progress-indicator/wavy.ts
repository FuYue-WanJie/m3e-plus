/**
 * Linear wavy progress geometry and animation, ported from AndroidX Compose Material3
 * `LinearWavyProgressModifiers.kt` (expressive). Pure functions produce SVG path data so the
 * engine runs without Canvas / PathMeasure; arc length is measured analytically per half-wave.
 *
 * Coordinate model: the wavy indicator draws into a local space where x runs `0..width` and the
 * baseline (the track centre) sits at `y = height / 2`. Half-waves are quadratic Béziers whose
 * control point peaks at `±(height - stroke)` before the amplitude Y-scale is applied.
 */

/** A single quadratic Bézier segment: start, control, end. */
export interface QuadSegment {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
}

/** A horizontal line span `[start, end]` along the baseline (used for the flat track). */
export type Span = readonly [start: number, end: number];

/** Geometry inputs shared by the drawing helpers. */
export interface WavyGeometry {
  /** Full drawing width in px. */
  width: number;
  /** Full drawing height in px (includes the wave's vertical extent). */
  height: number;
  /** Active stroke width in px. */
  stroke: number;
  /** Track stroke width in px. */
  trackStroke: number;
  /** Wavelength in px (one full sine period). */
  wavelength: number;
}

/** Options for {@link linearWaveLayout}. */
export interface LinearWaveLayoutOptions extends WavyGeometry {
  /** Progress fractions as `[tail0, head0, tail1, head1, ...]`, each 0..1. */
  fractions: readonly number[];
  /** Gap between active parts and the track in px. */
  gap: number;
  /** Stop indicator size in px. */
  stopSize: number;
  /** Active stroke cap. */
  cap: "butt" | "round" | "square";
  /** Track stroke cap. */
  trackCap: "butt" | "round" | "square";
}

/** Result of {@link linearWaveLayout}: where the active wave parts, track spans and stop sit. */
export interface LinearWaveLayout {
  /** Active wave spans in px `[start, end]` (along x). */
  active: Span[];
  /** Track spans in px `[start, end]` (along x, flat baseline). */
  tracks: Span[];
  /** Room reserved for stroke caps at each end, in px. */
  capWidth: number;
  /** Stop indicator position/size, or null when omitted. */
  stop: { x: number; y: number; size: number } | null;
}

/**
 * Clamp a stroke cap contribution the way AndroidX does: rounded/ squared caps need half a stroke
 * of room at each end, but a fully butt-capped bar, or a bar taller than it is wide, needs none.
 */
export function strokeCapWidth(
  cap: "butt" | "round" | "square",
  trackCap: "butt" | "round" | "square",
  stroke: number,
  trackStroke: number,
  width: number,
  height: number,
): number {
  if ((cap === "butt" && trackCap === "butt") || height > width) return 0;
  return Math.max(stroke / 2, trackStroke / 2);
}

// ── Half-wave analytic arc length ────────────────────────────────────────────────────────────────
//
// The full-amplitude path is a chain of identical quadratic half-waves. Each half-wave has endpoints
// at y = 0 separated by `dx = wavelength / 2` and a control point at y = ±dy, peaking at dy / 2.
// Its arc length has a closed form; we use it to turn a distance along the path into a parameter t
// so a progress segment is cut at exactly the right place (matching Skia PathMeasure).

/** Arc length of a half-wave and the inverse (distance -> parameter t in 0..1). */
export interface HalfWaveMeasure {
  length: number;
  /** Distance along the half-wave at parameter t (0..1). */
  at(t: number): number;
  /** Parameter t (0..1) at the given distance along the half-wave. */
  tAt(distance: number): number;
}

/** Build the analytic arc-length measure for a half-wave of horizontal span `dx` and peak control `dy`. */
export function halfWaveMeasure(dx: number, dy: number): HalfWaveMeasure {
  const b = 2 * Math.abs(dy);
  if (b === 0 || dx === 0) {
    return {
      length: Math.abs(dx),
      at: (t) => t * Math.abs(dx),
      tAt: (distance) => (dx === 0 ? 0 : distance / Math.abs(dx)),
    };
  }
  // Antiderivative of the quadratic Bézier speed: 0.5 * (u * hypot(dx, b u) + dx^2/b * asinh(b u / dx)).
  const primitive = (u: number): number => {
    const bu = b * u;
    return 0.5 * (u * Math.hypot(dx, bu) + ((dx * dx) / b) * Math.asinh(bu / dx));
  };
  const total = primitive(1);
  return {
    length: total,
    // Parameter t where the remaining fraction (1 - t) maps back from the primitive.
    at: (t) => (total - primitive(1 - 2 * t)) / 2,
    tAt(distance) {
      if (distance <= 0) return 0;
      if (distance >= total) return 1;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        if (this.at(mid) < distance) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    },
  };
}

// ── Quadratic Bézier splitting (de Casteljau) ────────────────────────────────────────────────────

/** Split a quadratic Bézier at `t`, returning the `[0,t]` and `[t,1]` halves. */
export function splitQuad(seg: QuadSegment, t: number): [QuadSegment, QuadSegment] {
  const ax = seg.x0 + (seg.cx - seg.x0) * t;
  const ay = seg.y0 + (seg.cy - seg.y0) * t;
  const bx = seg.cx + (seg.x1 - seg.cx) * t;
  const by = seg.cy + (seg.y1 - seg.cy) * t;
  const mx = ax + (bx - ax) * t;
  const my = ay + (by - ay) * t;
  return [
    { x0: seg.x0, y0: seg.y0, cx: ax, cy: ay, x1: mx, y1: my },
    { x0: mx, y0: my, cx: bx, cy: by, x1: seg.x1, y1: seg.y1 },
  ];
}

// ── Full-amplitude half-wave chain ───────────────────────────────────────────────────────────────

// ── Segment cutting ─────────────────────────────────────────────────────────────────────────────

/** A cubic or quadratic curve ready to serialize; only quadratic is produced here. */
export interface PathCommand {
  type: "M" | "L" | "Q";
  points: number[];
}

/**
 * Cut the flat full-amplitude wave chain over the horizontal span `[startX, endX]` (shifted by
 * `phase * wavelength`) into the quadratic curves that make up that portion. Returned commands are
 * in the flat space (baseline y = 0, peaks at ±dy); callers apply the amplitude Y-scale.
 */
export function cutWave(startX: number, endX: number, geom: WavyGeometry, phase: number): QuadSegment[] {
  if (endX <= startX) return [];
  const dx = geom.wavelength / 2;
  const shift = phase * geom.wavelength;
  // Half-waves are uniform in arc length, so flatten to per-wave arc-length offsets.
  const measure = halfWaveMeasure(dx, Math.max(0, geom.height - geom.stroke));
  const segLen = measure.length;
  const from = startX + shift;
  const to = endX + shift;
  const result: QuadSegment[] = [];
  const firstWave = Math.floor(from / dx);
  const lastWave = Math.ceil(to / dx);
  for (let w = firstWave; w < lastWave; w++) {
    // Position within this half-wave, in flat-x terms; empty arcs (dy=0) use dx as length.
    const waveStartX = w * dx;
    const localFrom = Math.max(0, from - waveStartX);
    const localTo = Math.min(dx, to - waveStartX);
    if (localTo <= localFrom) continue;
    const peak = w % 2 === 0 ? -1 : 1;
    const dy = Math.max(0, geom.height - geom.stroke) * peak;
    let seg: QuadSegment = {
      x0: waveStartX,
      y0: 0,
      cx: waveStartX + dx / 2,
      cy: dy,
      x1: waveStartX + dx,
      y1: 0,
    };
    const tFrom = segLen === 0 ? 0 : measure.tAt(localFrom);
    const tTo = segLen === 0 ? 1 : measure.tAt(localTo);
    let lo = 0;
    let hi = 1;
    if (tTo < 1) {
      const [left] = splitQuad(seg, tTo);
      seg = left;
      hi = tTo;
    }
    if (tFrom > 0) {
      const ratio = hi === 0 ? 0 : tFrom / hi;
      const [, right] = splitQuad(seg, Math.max(0, Math.min(1, ratio)));
      seg = right;
      lo = tFrom;
    }
    void lo;
    result.push({
      x0: seg.x0 - shift,
      y0: seg.y0,
      cx: seg.cx - shift,
      cy: seg.cy,
      x1: seg.x1 - shift,
      y1: seg.y1,
    });
  }
  return result;
}

// ── Amplitude Y-scale + baseline translate ──────────────────────────────────────────────────────

/**
 * Apply the amplitude Y-scale and centre the wave on the baseline, matching the native
 * `translate(y = (1 - amplitude) * halfHeight); scale(y = amplitude)` transform.
 */
export function scaleAmplitude(seg: QuadSegment, amplitude: number, height: number): QuadSegment {
  const halfHeight = height / 2;
  // Flat segments sit on baseline y = 0 (endpoints) with control points at ±(height - stroke). The
  // native draw transform scales Y by `amplitude` and keeps the baseline pinned at height / 2.
  const sy = (y: number): number => amplitude * y + halfHeight;
  return {
    x0: seg.x0,
    y0: sy(seg.y0),
    cx: seg.cx,
    cy: sy(seg.cy),
    x1: seg.x1,
    y1: sy(seg.y1),
  };
}

// ── SVG `d` serialization ────────────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : `${r}`;
};

/** Serialize quadratic segments to an SVG `d` string (a single `M` then `Q`s). */
export function segmentsToPathData(segments: readonly QuadSegment[]): string {
  if (segments.length === 0) return "";
  const parts: string[] = [`M ${fmt(segments[0].x0)} ${fmt(segments[0].y0)}`];
  for (const s of segments) {
    parts.push(`Q ${fmt(s.cx)} ${fmt(s.cy)} ${fmt(s.x1)} ${fmt(s.y1)}`);
  }
  return parts.join(" ");
}

/** Serialize a flat baseline span to an SVG `d` (a straight line at `y`). */
export function spanToPathData(span: Span, y: number): string {
  return `M ${fmt(span[0])} ${fmt(y)} L ${fmt(span[1])} ${fmt(y)}`;
}

// ── Track / gap / stop adaptive layout (port of updateDrawPaths) ─────────────────────────────────

/**
 * Compute active wave spans, flat track spans and the stop position, using AndroidX's adaptive gap
 * rules: the gap between active and track shrinks when the bar's head has just entered the track,
 * and rounded caps reserve `capWidth` at each end.
 */
export function linearWaveLayout(options: LinearWaveLayoutOptions): LinearWaveLayout {
  const { width, height, stroke, trackStroke, fractions, gap, stopSize, cap, trackCap } = options;
  const capWidth = strokeCapWidth(cap, trackCap, stroke, trackStroke, width, height);
  const clampX = (x: number): number => Math.max(capWidth, Math.min(x, width - capWidth));

  const active: Span[] = [];
  const tracks: Span[] = [];
  let nextEnd = width - capWidth;
  let adaptiveGap = gap;
  let visible = false;

  for (let i = 0; i < fractions.length; i += 2) {
    const tail = fractions[i] * width;
    const head = fractions[i + 1] * width;

    if (i === 0) {
      adaptiveGap = head < capWidth ? 0 : Math.min(head - capWidth, gap);
      visible = head >= capWidth;
    }

    const start = clampX(tail);
    const end = clampX(head);
    if (end > start) active.push([start, end]);

    const spacing = visible ? adaptiveGap + capWidth * 2 : adaptiveGap;
    if (nextEnd > end + spacing) {
      tracks.push([nextEnd, Math.max(capWidth, end + spacing)]);
    }
    if (head > tail) {
      nextEnd = Math.max(capWidth, start - spacing);
    }
  }

  if (nextEnd > capWidth) tracks.push([nextEnd, capWidth]);

  // Stop indicator: only for a single active part by default (fractions.length > 2 suppresses it in
  // AndroidX for multi-part indeterminate), encoded so the caller can decide. Here we mirror the
  // AndroidX stop box: shrink to leave room at the far end when progress reaches it.
  let stop: LinearWaveLayout["stop"] = null;
  if (fractions.length <= 2 && stopSize > 0) {
    let size = Math.min(trackStroke, stopSize);
    let x = width - size - (size === trackStroke ? 0 : trackStroke / 4);
    const progressX = width * fractions[1] + capWidth;
    if (x <= progressX) {
      size = Math.max(0, size - (progressX - x));
      x = progressX;
    }
    if (size > 0) stop = { x: x + size / 2, y: height / 2, size };
  }

  return { active, tracks, capWidth, stop };
}

// ── Amplitude easing (port of Increasing/DecreasingAmplitudeAnimationSpec) ───────────────────────

const AMPLITUDE_DURATION_MS = 550; // MotionTokens.DurationLong2

/** Cubic-bezier easing evaluator (matches Material motion easing curves). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  const solveX = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dxErr = sampleX(t) - x;
      if (Math.abs(dxErr) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dxErr / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveX(t));
  };
}

/** Standard easing (rise) and EmphasizedAccelerate (fall/indeterminate), matching Material tokens. */
const standardEasing = cubicBezier(0.2, 0, 0, 1);
/** `MotionTokens.EasingEmphasizedAccelerateCubicBezier` — also used by the linear indeterminate. */
const emphasizedAccelerateEasing = cubicBezier(0.3, 0, 0.8, 0.15);

/** Material EmphasizedAccelerate easing applied to a normalized 0..1 input. */
export function emphasizedAccelerate(t: number): number {
  return emphasizedAccelerateEasing(Math.max(0, Math.min(1, t)));
}

// ── Linear indeterminate fractions ─────────────────────────────────────────────────────────────

/** Cycle length of the linear indeterminate animation (AndroidX `LinearAnimationDuration`). */
export const LINEAR_INDETERMINATE_DURATION_MS = 1750;

/** Wave travel period in ms: one wavelength per second (AndroidX waveSpeed defaults to wavelength). */
const WAVE_PERIOD_MS = 1000;

/**
 * The four animated fractions of the linear indeterminate indicator, in the order AndroidX's
 * `getProgressFractions` emits them: `[firstTail, firstHead, secondTail, secondHead]`. Each part is
 * a keyframe ramp `0 -> 1` over its own delay + duration, eased with EmphasizedAccelerate
 * (`LinearIndeterminateProgressEasing`). Reads the loop time `elapsedMs` modulo the cycle.
 */
export function linearIndeterminateFractions(elapsedMs: number): number[] {
  const t = ((elapsedMs % LINEAR_INDETERMINATE_DURATION_MS) + LINEAR_INDETERMINATE_DURATION_MS) % LINEAR_INDETERMINATE_DURATION_MS;
  const sample = (delay: number, duration: number): number =>
    emphasizedAccelerate((t - delay) / duration);
  // Delays/durations from ProgressIndicator.kt (FirstLineHead/Tail, SecondLineHead/Tail).
  return [sample(250, 1000), sample(0, 1000), sample(900, 850), sample(650, 850)];
}

/**
 * Advance an amplitude tween one frame. Rising uses Standard easing; falling uses
 * EmphasizedAccelerate. Returns the eased amplitude and the updated elapsed time.
 */
export function stepAmplitude(from: number, to: number, elapsedMs: number, dt: number): { value: number; elapsed: number } {
  if (from === to) return { value: to, elapsed: 0 };
  const elapsed = Math.min(AMPLITUDE_DURATION_MS, elapsedMs + dt);
  const t = elapsed / AMPLITUDE_DURATION_MS;
  const eased = (to > from ? standardEasing : emphasizedAccelerateEasing)(t);
  return { value: from + (to - from) * eased, elapsed };
}

/** The amplitude function that switches waves on between 10% and 95% progress (native default). */
export function defaultAmplitudeForProgress(progress: number): number {
  return progress <= 0.1 || progress >= 0.95 ? 0 : 1;
}

// ── rAF driver ──────────────────────────────────────────────────────────────────────────────────

/** A frame callback: receives the current phase (0..1), amplitude (0..1) and both path datas. */
export interface WaveFrame {
  phase: number;
  amplitude: number;
  /** Active wave `d` for the given spans, or empty when nothing to draw. */
  activePaths: string[];
  /** Flat track `d` strings. */
  trackPaths: string[];
  /** Stop indicator, if any. */
  stop: LinearWaveLayout["stop"];
}

/** Options for {@link WaveDriver}. */
export interface WaveDriverOptions extends WavyGeometry {
  /** Active stroke cap. */
  cap: "butt" | "round" | "square";
  /** Track stroke cap. */
  trackCap: "butt" | "round" | "square";
  /** Gap between active and track in px. */
  gap: number;
  /** Stop indicator size in px. */
  stopSize: number;
  /** Called every animation frame with the computed frame geometry. */
  onFrame: (frame: WaveFrame) => void;
}

/**
 * Drives the linear wavy indicator with `requestAnimationFrame`: the phase advances at constant
 * speed (`wavelength / speed` per cycle) while the amplitude eases toward the target implied by the
 * current progress. Geometry is regenerated each frame from the pure helpers above.
 */
export class WaveDriver {
  #geom: WavyGeometry;
  #cap: WaveDriverOptions["cap"];
  #trackCap: WaveDriverOptions["trackCap"];
  #gap: number;
  #stopSize: number;
  #onFrame: (frame: WaveFrame) => void;

  #fractions: readonly number[] = [0, 0];
  #fractionProvider?: () => readonly number[];
  #targetAmplitude = 0;
  #animateAmplitude = true;

  #phase = 0;
  #amplitudeFrom = 0;
  #amplitudeValue = 0;
  #amplitudeElapsed = 0;

  #raf: number | null = null;
  #lastTime = 0;
  #running = false;
  #reducedMotion = false;

  constructor(options: WaveDriverOptions) {
    this.#geom = {
      width: options.width,
      height: options.height,
      stroke: options.stroke,
      trackStroke: options.trackStroke,
      wavelength: options.wavelength,
    };
    this.#cap = options.cap;
    this.#trackCap = options.trackCap;
    this.#gap = options.gap;
    this.#stopSize = options.stopSize;
    this.#onFrame = options.onFrame;
  }

  /** Update geometry (on resize / attribute change). */
  setGeometry(geom: Partial<WavyGeometry> & { cap?: WaveDriverOptions["cap"]; trackCap?: WaveDriverOptions["trackCap"]; gap?: number; stopSize?: number }): void {
    if (geom.width !== undefined) this.#geom.width = geom.width;
    if (geom.height !== undefined) this.#geom.height = geom.height;
    if (geom.stroke !== undefined) this.#geom.stroke = geom.stroke;
    if (geom.trackStroke !== undefined) this.#geom.trackStroke = geom.trackStroke;
    if (geom.wavelength !== undefined) this.#geom.wavelength = geom.wavelength;
    if (geom.cap !== undefined) this.#cap = geom.cap;
    if (geom.trackCap !== undefined) this.#trackCap = geom.trackCap;
    if (geom.gap !== undefined) this.#gap = geom.gap;
    if (geom.stopSize !== undefined) this.#stopSize = geom.stopSize;
  }

  /**
   * Set the progress fractions and the amplitude policy.
   * @param fractions `[tail, head, ...]` pairs (0..1).
   * @param targetAmplitude the amplitude (0..1) the wave should ease toward; when
   *   `animateAmplitude` is false it is applied instantly (indeterminate / reduced motion).
   * @param animateAmplitude whether to ease the amplitude this update.
   */
  setProgress(
    fractions: readonly number[] | (() => readonly number[]),
    targetAmplitude: number,
    animateAmplitude = true,
  ): void {
    if (typeof fractions === "function") {
      this.#fractionProvider = fractions;
    } else {
      this.#fractionProvider = undefined;
      this.#fractions = fractions;
    }
    if (targetAmplitude !== this.#targetAmplitude) {
      this.#amplitudeFrom = this.#amplitudeValue;
      this.#amplitudeElapsed = 0;
    }
    this.#targetAmplitude = targetAmplitude;
    this.#animateAmplitude = animateAmplitude && !this.#reducedMotion;
    if (!this.#animateAmplitude) {
      this.#amplitudeValue = targetAmplitude;
      this.#amplitudeFrom = targetAmplitude;
    }
  }

  /** Whether a wave motion is currently required (amplitude > 0 and visible). */
  get needsAnimation(): boolean {
    return this.#amplitudeValue > 0 || this.#targetAmplitude > 0;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = 0;
    this.#raf = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    this.#running = false;
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  /** Respect `prefers-reduced-motion`: freeze the wave at a static phase with no amplitude animation. */
  setReducedMotion(reduced: boolean): void {
    this.#reducedMotion = reduced;
    if (reduced) {
      this.#phase = 0;
      this.#amplitudeValue = this.#targetAmplitude;
      this.#amplitudeFrom = this.#targetAmplitude;
      this.#render();
    }
  }

  #tick = (time: number): void => {
    if (!this.#running) return;
    const raw = this.#lastTime === 0 ? 16.7 : time - this.#lastTime;
    const dt = Math.min(64, Math.max(0, raw));
    this.#lastTime = time;

    if (!this.#reducedMotion) {
      // Advance phase: one wavelength per wave period (wavelength px / wavelength px-per-sec).
      // AndroidX: period = (wavelength / waveSpeed) * 1000 ms. The component's waveSpeed defaults to
      // the wavelength (one wavelength per second), so the period is a constant 1000 ms.
      this.#phase = (this.#phase + dt / WAVE_PERIOD_MS) % 1;

      if (this.#animateAmplitude && this.#amplitudeValue !== this.#targetAmplitude) {
        const step = stepAmplitude(this.#amplitudeFrom, this.#targetAmplitude, this.#amplitudeElapsed, dt);
        this.#amplitudeValue = step.value;
        this.#amplitudeElapsed = step.elapsed;
        if (step.elapsed >= AMPLITUDE_DURATION_MS) this.#amplitudeValue = this.#targetAmplitude;
      }
    }

    this.#render();
    this.#raf = requestAnimationFrame(this.#tick);
  };

  /** Regenerate geometry and emit one frame. */
  #render(): void {
    const fractions = this.#fractionProvider ? this.#fractionProvider() : this.#fractions;
    const layout = linearWaveLayout({
      ...this.#geom,
      fractions,
      gap: this.#gap,
      stopSize: this.#stopSize,
      cap: this.#cap,
      trackCap: this.#trackCap,
    });
    const activePaths = layout.active.map((span) =>
      segmentsToPathData(scaleAmplitudeAll(cutWave(span[0], span[1], this.#geom, this.#phase), this.#amplitudeValue, this.#geom.height)),
    );
    const trackPaths = layout.tracks.map((span) => spanToPathData(span, this.#geom.height / 2));
    this.#onFrame({
      phase: this.#phase,
      amplitude: this.#amplitudeValue,
      activePaths,
      trackPaths,
      stop: layout.stop,
    });
  }
}

function scaleAmplitudeAll(segments: QuadSegment[], amplitude: number, height: number): QuadSegment[] {
  return segments.map((s) => scaleAmplitude(s, amplitude, height));
}
