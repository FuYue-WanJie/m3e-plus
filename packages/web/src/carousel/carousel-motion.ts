/**
 * Carousel motion: velocity tracking, Android fling decay and an analytic damped spring.
 *
 * `leastSquaresVelocity` / `VelocityTracker` (VelocityTracker1D, Lsq2) and `FlingDecay`
 * (AndroidFlingSpline + SplineBasedFloatDecayAnimationSpec) are adapted from md3e-web-unofficial
 * (Apache-2.0), themselves ports of AndroidX Compose (Copyright The Android Open Source Project,
 * Apache-2.0). See THIRD_PARTY_NOTICES.md. Float math uses `Math.fround` to mirror Kotlin `Float`.
 */

const fr = Math.fround;

/** Maximum fling velocity, px/s (`ViewConfiguration.maximumFlingVelocity` at 1dp = 1px). */
export const MAX_FLING_VELOCITY = 8000;
/** `PagerDefaults`/`SnapFlingBehavior` constants, 1dp = 1 CSS px. */
export const MIN_FLING_VELOCITY = 400;
export const POSITION_THRESHOLD = 56;
export const SNAP_POSITIONAL_THRESHOLD = 0.5;

/** Touch slop in px (Compose: 8dp for touch; mouse uses a tiny slop so clicks stay clicks). */
export const touchSlop = (pointerType: string): number => (pointerType === "mouse" ? fr(8 * fr(0.125 / 18)) : 8);

/** A damped spring: stiffness `k`, damping ratio `z`; `coerce` stops it from passing its target. */
export interface CarouselSpring {
  k: number;
  z: number;
  coerce: boolean;
}

/** `spring(StiffnessMediumLow)`, critically damped — the pager's snap spring. */
export const STANDARD_SNAP_SPRING: CarouselSpring = Object.freeze({ k: 400, z: 1, coerce: true });
/** M3 Expressive spatial-fast spring: stiffer, under-damped, allowed to bounce past the target. */
export const EXPRESSIVE_SNAP_SPRING: CarouselSpring = Object.freeze({ k: 800, z: 0.6, coerce: false });
/** `animateScrollToItem`'s default `spring()`. */
export const SCROLL_SPRING: CarouselSpring = Object.freeze({ k: 1500, z: 1, coerce: true });

const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let r = 0;
  for (let i = 0; i < a.length; i++) r = fr(r + fr(a[i] * b[i]));
  return r;
};

interface Sample {
  time: number;
  position: number;
}

/** Least-squares (degree 2) velocity over the last 100ms of samples, px/s. */
export function leastSquaresVelocity(samples: readonly Sample[], maximum = MAX_FLING_VELOCITY): number {
  const newest = samples[samples.length - 1];
  if (!newest) return 0;
  const points: number[] = [];
  const times: number[] = [];
  let previous = newest;
  for (let i = samples.length - 1; i >= 0 && points.length < 20; i--) {
    const s = samples[i];
    const age = fr(newest.time - s.time);
    const gap = fr(Math.abs(s.time - previous.time));
    previous = s;
    if (age > 100 || gap > 40) break;
    points.push(fr(s.position));
    times.push(-age);
  }
  if (points.length < 2) return 0;
  const count = points.length;
  const n = Math.min(3, count);
  const a = Array.from({ length: n }, () => new Float32Array(count));
  const q = Array.from({ length: n }, () => new Float32Array(count));
  const r = Array.from({ length: n }, () => new Float32Array(n));
  for (let h = 0; h < count; h++) {
    a[0][h] = 1;
    for (let i = 1; i < n; i++) a[i][h] = fr(a[i - 1][h] * times[h]);
  }
  for (let j = 0; j < n; j++) {
    const w = q[j];
    w.set(a[j]);
    for (let i = 0; i < j; i++) {
      const z = q[i];
      const pr = dot(w, z);
      for (let h = 0; h < count; h++) w[h] = fr(w[h] - fr(pr * z[h]));
    }
    const inv = fr(1 / Math.max(fr(Math.sqrt(dot(w, w))), fr(1e-6)));
    for (let h = 0; h < count; h++) w[h] = fr(w[h] * inv);
    for (let i = 0; i < n; i++) r[j][i] = i < j ? 0 : dot(w, a[i]);
  }
  const c = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let v = dot(q[i], points);
    for (let j = n - 1; j > i; j--) v = fr(v - fr(r[i][j] * c[j]));
    c[i] = fr(v / r[i][i]);
  }
  const velocity = fr(c[1] * 1000);
  return Number.isNaN(velocity) ? 0 : Math.max(-maximum, Math.min(maximum, velocity));
}

/** Tracks pointer positions along one axis and reports the release velocity. */
export class VelocityTracker {
  #samples: Sample[] = [];
  #lastMove = 0;

  #add(time: number, position: number): void {
    this.#samples.push({ time: Math.floor(time), position: fr(position) });
    if (this.#samples.length > 20) this.#samples.shift();
  }

  down(time: number, position: number): void {
    this.#samples = [];
    this.#add(time, position);
    this.#lastMove = Math.floor(time);
  }

  move(time: number, position: number): void {
    this.#add(time, position);
    this.#lastMove = Math.floor(time);
  }

  /** Velocity at release; a pointer that rested for >40ms before lifting has none. */
  up(time: number, maximum = MAX_FLING_VELOCITY): number {
    if (Math.floor(time) - this.#lastMove > 40) this.#samples = [];
    return leastSquaresVelocity(this.#samples, maximum);
  }
}

const FlingSpline = (() => {
  const inflection = fr(0.35);
  const p1 = fr(fr(0.5) * inflection);
  const p2 = fr(1 - fr(1 - inflection));
  const positions = new Float32Array(101);
  let xMin = 0;
  for (let i = 0; i < 100; i++) {
    const alpha = fr(i / 100);
    let xMax = 1;
    let x = 0;
    let coef = 0;
    for (;;) {
      x = fr(xMin + fr(fr(xMax - xMin) / 2));
      coef = fr(fr(3 * x) * fr(1 - x));
      const tx = fr(fr(coef * fr(fr(fr(1 - x) * p1) + fr(x * p2))) + fr(fr(x * x) * x));
      if (Math.abs(fr(tx - alpha)) < 1e-5) break;
      if (tx > alpha) xMax = x;
      else xMin = x;
    }
    positions[i] = fr(fr(coef * fr(fr(fr(1 - x) * fr(0.5)) + x)) + fr(fr(x * x) * x));
  }
  positions[100] = 1;
  return { positions, inflection };
})();

/** Android's spline fling decay (`splineBasedDecay`), positions in px from the start. */
export class FlingDecay {
  readonly #friction = fr(0.015);
  readonly #physical = fr(fr(fr(fr(fr(9.80665) * fr(39.37)) * 1) * 160) * fr(0.84));
  readonly #rate = fr(Math.log(0.78) / Math.log(0.9));

  info(velocity: number): { velocity: number; distance: number; duration: number } {
    const v = fr(velocity);
    if (!v) return { velocity: 0, distance: 0, duration: 0 };
    const l = Math.log(fr(FlingSpline.inflection * Math.abs(v)) / fr(this.#friction * this.#physical));
    const m = this.#rate - 1;
    return {
      velocity: v,
      distance: fr(fr(this.#friction * this.#physical) * Math.exp((this.#rate / m) * l)),
      duration: Math.trunc(1000 * Math.exp(l / m)),
    };
  }

  /** Signed total distance a fling with `velocity` travels. */
  target(velocity: number): number {
    const i = this.info(velocity);
    return fr(i.distance * Math.sign(i.velocity));
  }

  /** Position and velocity `ms` milliseconds into the fling. */
  sample(ms: number, velocity: number): { position: number; velocity: number } {
    const i = this.info(velocity);
    if (!i.duration) return { position: 0, velocity: 0 };
    const fx = Math.max(0, Math.min(1, fr(Math.trunc(ms) / i.duration)));
    const idx = Math.trunc(100 * fx);
    const P = FlingSpline.positions;
    let dc = 1;
    let vc = 0;
    if (idx < 100) {
      const lo = idx / 100;
      const hi = (idx + 1) / 100;
      vc = fr((P[idx + 1] - P[idx]) / (hi - lo));
      dc = fr(P[idx] + fr((fx - lo) * vc));
    }
    const s = Math.sign(i.velocity);
    return { position: fr(i.distance * s * dc), velocity: fr(((vc * s * i.distance) / i.duration) * 1000) };
  }
}

/**
 * Closed-form damped spring displacement `x` and velocity `v` at `t` seconds, starting from
 * displacement `x0` (px from rest) with velocity `v0` (px/s).
 */
export function springSolve(x0: number, v0: number, k: number, z: number, t: number): { x: number; v: number } {
  const w = Math.sqrt(k);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const a = z * w;
    const c2 = (v0 + a * x0) / wd;
    const e = Math.exp(-a * t);
    return {
      x: e * (x0 * Math.cos(wd * t) + c2 * Math.sin(wd * t)),
      v: e * ((-a * x0 + wd * c2) * Math.cos(wd * t) + (-a * c2 - wd * x0) * Math.sin(wd * t)),
    };
  }
  const c2 = v0 + w * x0;
  const e = Math.exp(-w * t);
  return { x: (x0 + c2 * t) * e, v: (c2 - w * (x0 + c2 * t)) * e };
}
