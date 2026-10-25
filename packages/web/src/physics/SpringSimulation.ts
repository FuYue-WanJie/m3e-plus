/**
 * A frame-by-frame spring physics simulator for the web.
 *
 * The integrator is the analytic closed-form solution of a damped harmonic oscillator, transcribed
 * from AndroidX Compose `SpringSimulation.updateValues`
 * (`compose/animation/animation-core/.../SpringSimulation.kt`). It has been verified against a Kotlin
 * oracle generated from the real source (see `parse-new/out/slider-snap-spring-oracle.json`): 64/64
 * arbitrary-velocity step cases match to floating-point precision, across under-, critically- and
 * over-damped regimes.
 *
 * Unlike `theme/SpringEasing.ts` (which samples a unit-displacement, zero-velocity spring into a
 * static CSS `linear()` curve), this simulator supports an arbitrary initial velocity and advances
 * per animation frame via `requestAnimationFrame`, so an interruption (e.g. releasing a press
 * mid-flight) can carry over the current position *and* velocity — real inertia.
 *
 * The physics is expressed for a unit mass: `naturalFreq = sqrt(stiffness)`,
 * `acceleration = -stiffness * displacement - 2 * dampingRatio * naturalFreq * velocity`.
 */

/** A snapshot of the spring's motion. */
export interface SpringFrame {
  /** The current position. */
  readonly value: number;

  /** The current velocity, in position units per second. */
  readonly velocity: number;
}

/** Options that configure a {@link SpringSimulation}. */
export interface SpringSimulationOptions {
  /** The stiffness constant (spring constant for a unit mass). Must be positive. */
  readonly stiffness: number;

  /** The damping ratio: 0 = undamped, <1 under-damped, 1 critically damped, >1 over-damped. */
  readonly dampingRatio: number;

  /** The initial velocity, in position units per second. Defaults to 0. */
  readonly velocity?: number;

  /** The initial target (rest) position. Defaults to 0. */
  readonly target?: number;

  /** The initial position. Defaults to 0. */
  readonly value?: number;

  /**
   * The displacement below which the spring is considered at rest (position units). For a 0..1
   * progress spring, use a small value like 0.001 so the simulation runs its full trajectory
   * (including overshoot) instead of stopping prematurely. Defaults to a relative 0.1% of the
   * distance being animated.
   */
  readonly valueThreshold?: number;

  /**
   * The speed below which the spring is considered at rest (position units per second). Defaults
   * to a relative 0.2% of the animated distance per second.
   */
  readonly velocityThreshold?: number;
}

/**
 * Determines whether a value counts as "at rest" against a target.
 * @param {number} value The current value.
 * @param {number} velocity The current velocity.
 * @param {number} target The target value.
 * @param {number} valueThreshold The maximum displacement still considered at rest.
 * @param {number} velocityThreshold The maximum speed still considered at rest.
 * @returns {boolean} Whether the spring is at rest.
 */
function isAtRest(
  value: number,
  velocity: number,
  target: number,
  valueThreshold: number,
  velocityThreshold: number,
): boolean {
  return Math.abs(value - target) < valueThreshold && Math.abs(velocity) < velocityThreshold;
}

/**
 * A per-frame damped-spring simulation. Call {@link SpringSimulation.start} to animate the value
 * toward a target and receive intermediate values via `onUpdate`; call {@link SpringSimulation.stop}
 * to cancel. The controller's current `value`/`velocity` can be read at any time.
 */
export class SpringSimulation {
  readonly #stiffness: number;
  readonly #dampingRatio: number;
  #value = 0;
  #velocity: number;
  #target = 0;
  #frame = 0;
  #lastTime = 0;
  #running = false;
  #explicitValueThreshold: boolean;
  #explicitVelocityThreshold: boolean;

  /**
   * Creates a spring simulation.
   * @param {SpringSimulationOptions} options The spring configuration.
   */
  constructor(options: SpringSimulationOptions) {
    if (!(options.stiffness > 0)) {
      throw new RangeError("SpringSimulation: stiffness must be positive.");
    }
    if (!(options.dampingRatio >= 0)) {
      throw new RangeError("SpringSimulation: dampingRatio must be non-negative.");
    }
    this.#stiffness = options.stiffness;
    this.#dampingRatio = options.dampingRatio;
    this.#velocity = options.velocity ?? 0;
    this.#target = options.target ?? 0;
    this.#value = options.value ?? 0;

    this.#explicitValueThreshold = options.valueThreshold !== undefined;
    this.#explicitVelocityThreshold = options.velocityThreshold !== undefined;
    this.valueThreshold = options.valueThreshold ?? 0;
    this.velocityThreshold = options.velocityThreshold ?? 0;
    if (!this.#explicitValueThreshold || !this.#explicitVelocityThreshold) {
      this.#applyDefaultThresholds();
    }
  }

  /** The current position. */
  get value(): number {
    return this.#value;
  }

  /** The current velocity, in position units per second. */
  get velocity(): number {
    return this.#velocity;
  }

  /** Whether the simulation is currently running. */
  get isRunning(): boolean {
    return this.#running;
  }

  /**
   * Sets the current position without disturbing velocity.
   * @param {number} value The new position.
   * @returns {this} The simulation, for chaining.
   */
  setValue(value: number): this {
    this.#value = value;
    return this;
  }

  /**
   * Sets the current velocity, e.g. to carry momentum across an interruption.
   * @param {number} velocity The new velocity, in position units per second.
   * @returns {this} The simulation, for chaining.
   */
  setVelocity(velocity: number): this {
    this.#velocity = velocity;
    return this;
  }

  /**
   * Sets the target (rest) position used by {@link SpringSimulation.step}. Does not restart the
   * simulation; use {@link SpringSimulation.start} for frame-driven animation.
   * @param {number} target The target value.
   * @returns {this} The simulation, for chaining.
   */
  setTarget(target: number): this {
    this.#target = target;
    return this;
  }

  /**
   * Advances the spring by a fixed time step using the analytic solution.
   * @param {number} dtMs The elapsed time, in milliseconds.
   * @returns {SpringFrame} The new position and velocity.
   */
  step(dtMs: number): SpringFrame {
    const { value, velocity } = this.#integrate(this.#value, this.#velocity, this.#target, dtMs);
    this.#value = value;
    this.#velocity = velocity;
    return { value, velocity };
  }

  /**
   * Animates the current value toward `target` over animation frames.
   * @param {number} target The value to settle at.
   * @param {(frame: SpringFrame) => void} [onUpdate] Called each frame with the new state.
   * @param {() => void} [onComplete] Called once the spring comes to rest (or is stopped).
   * @returns {void}
   */
  start(target: number, onUpdate?: (frame: SpringFrame) => void, onComplete?: () => void): void {
    this.stop();
    this.#target = target;
    // If called with different targets over time, refresh the automatic rest thresholds so the
    // spring is expected to settle near the *current* target distance, not the constructor's.
    if (!this.#explicitValueThreshold || !this.#explicitVelocityThreshold) {
      this.#applyDefaultThresholds();
    }
    this.#running = true;
    this.#lastTime = 0;
    const tick = (time: number): void => {
      if (!this.#running) {
        return;
      }
      const dt = this.#lastTime === 0 ? 1000 / 60 : time - this.#lastTime;
      this.#lastTime = time;
      const frame = this.step(dt);
      onUpdate?.(frame);
      if (isAtRest(frame.value, frame.velocity, target, this.valueThreshold, this.velocityThreshold)) {
        this.#value = target;
        this.#velocity = 0;
        onUpdate?.({ value: this.#value, velocity: 0 });
        this.#running = false;
        onComplete?.();
        return;
      }
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  /**
   * Computes rest-detection thresholds from the current target distance. The value threshold is a
   * tiny fraction of the animated distance and the velocity threshold scales similarly, so a 0..1
   * progress spring settles only once it is actually near its target (after any overshoot) instead
   * of stopping halfway or at the overshoot peak.
   * @private
   */
  #applyDefaultThresholds(): void {
    const distance = Math.abs(this.#target - this.#value);
    // Value: 0.1% of the animated distance, or 1e-4 when no movement was requested. Velocity: small
    // enough that the "settled" state has perceptibly stopped, but not so tight that a low-amplitude
    // spring takes hundreds of frames to declare rest.
    this.valueThreshold = this.#explicitValueThreshold ? this.valueThreshold : Math.max(distance * 0.001, 1e-4);
    this.velocityThreshold = this.#explicitVelocityThreshold
      ? this.velocityThreshold
      : Math.max(distance * 0.002, 1e-3);
  }

  /** Stops the simulation, if running. Does not fire `onComplete`. @returns {void} */
  stop(): void {
    if (this.#running) {
      cancelAnimationFrame(this.#frame);
      this.#running = false;
    }
  }

  /** The displacement below which the spring is considered at rest (position units). */
  valueThreshold = 0.5;

  /** The speed below which the spring is considered at rest (position units per second). */
  velocityThreshold = 2;

  /**
   * The core analytic integrator. Transcribed from `SpringSimulation.updateValues` (AndroidX).
   * @param {number} lastDisplacement The current position.
   * @param {number} lastVelocity The current velocity.
   * @param {number} finalPosition The target position.
   * @param {number} timeElapsedMs The elapsed time, in milliseconds.
   * @returns {SpringFrame} The new position and velocity.
   */
  #integrate(
    lastDisplacement: number,
    lastVelocity: number,
    finalPosition: number,
    timeElapsedMs: number,
  ): SpringFrame {
    const naturalFreq = Math.sqrt(this.#stiffness);
    const dampingRatio = this.#dampingRatio;
    const adjustedDisplacement = lastDisplacement - finalPosition;
    const deltaT = timeElapsedMs / 1000;
    const dampingRatioSquared = dampingRatio * dampingRatio;
    const r = -dampingRatio * naturalFreq;

    let displacement: number;
    let currentVelocity: number;

    if (dampingRatio > 1) {
      // Over-damped
      const s = naturalFreq * Math.sqrt(dampingRatioSquared - 1);
      const gammaPlus = r + s;
      const gammaMinus = r - s;
      const coeffB = (gammaMinus * adjustedDisplacement - lastVelocity) / (gammaMinus - gammaPlus);
      const coeffA = adjustedDisplacement - coeffB;
      displacement = coeffA * Math.exp(gammaMinus * deltaT) + coeffB * Math.exp(gammaPlus * deltaT);
      currentVelocity =
        coeffA * gammaMinus * Math.exp(gammaMinus * deltaT) +
        coeffB * gammaPlus * Math.exp(gammaPlus * deltaT);
    } else if (dampingRatio === 1) {
      // Critically damped
      const coeffA = adjustedDisplacement;
      const coeffB = lastVelocity + naturalFreq * adjustedDisplacement;
      const nFdT = -naturalFreq * deltaT;
      displacement = (coeffA + coeffB * deltaT) * Math.exp(nFdT);
      currentVelocity =
        (coeffA + coeffB * deltaT) * Math.exp(nFdT) * -naturalFreq + coeffB * Math.exp(nFdT);
    } else {
      // Under-damped
      const dampedFreq = naturalFreq * Math.sqrt(1 - dampingRatioSquared);
      const cosCoeff = adjustedDisplacement;
      const sinCoeff = (1 / dampedFreq) * (-r * adjustedDisplacement + lastVelocity);
      const dFdT = dampedFreq * deltaT;
      displacement =
        Math.exp(r * deltaT) * (cosCoeff * Math.cos(dFdT) + sinCoeff * Math.sin(dFdT));
      currentVelocity =
        displacement * r +
        Math.exp(r * deltaT) *
          (-dampedFreq * cosCoeff * Math.sin(dFdT) + dampedFreq * sinCoeff * Math.cos(dFdT));
    }

    return { value: displacement + finalPosition, velocity: currentVelocity };
  }
}
