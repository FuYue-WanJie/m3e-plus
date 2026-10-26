import { css, CSSResultGroup, html, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import {
  AnimationLoopController,
  customElement,
  DesignToken,
  ResizeController,
} from "@wanjie/m3e-web/core";
import {
  circularVertexCount,
  determinateAmplitude,
  easeStandard,
  easeEmphasizedAccelerate,
  generateCircularWavyPath,
  indeterminateState,
  roundedStarSamples,
  type CircularWavyOptions,
} from "@wanjie/m3e-web/geometry";
import {
  arcToPath,
  classicCircularDeterminate,
  classicCircularIndeterminate,
  type Arc,
} from "./classic-progress";

import { ProgressElementIndicatorBase } from "./ProgressElementIndicatorBase";

/**
 * A circular indicator of progress and activity.
 *
 * @description
 * The `m3e-circular-progress-indicator` component displays a circular progress spinner for
 * tracking the completion of a task or process. It supports determinate and indeterminate
 * modes, and can be customized with CSS custom properties for diameter, stroke width, and
 * color. The component is accessible, animates smoothly, and adapts to various use cases including
 * loading and activity indication.
 *
 * @example
 * The following example illustrates a determinate circular progress indicator.
 * ```html
 * <m3e-circular-progress-indicator value="30"></m3e-circular-progress-indicator>
 * ```
 * @example
 * The next example illustrates an indeterminate circular progress indicator using the `indeterminate` attribute.
 * ```html
 * <m3e-circular-progress-indicator indeterminate></m3e-circular-progress-indicator>
 * ```
 *
 * @tag m3e-circular-progress-indicator
 *
 * @slot - Renders the content inside the progress indicator.
 *
 * @attr indeterminate - Whether to show something is happening without conveying progress.
 * @attr max - The maximum progress value.
 * @attr value - A fractional value, between 0 and `max`, indicating progress.
 * @attr variant - The appearance of the indicator.
 *
 * @cssprop --m3e-circular-flat-progress-indicator-diameter - Diameter of the `flat` variant.
 * @cssprop --m3e-circular-wavy-progress-indicator-diameter - Diameter of the `wavy` variant.
 * @cssprop --m3e-circular-wavy-progress-indicator-amplitude - Amplitude of the `wavy` variant.
 * @cssprop --m3e-circular-wavy-progress-indicator-wavelength - Wavelength of the `wavy` variant.
 * @cssprop --m3e-circular-progress-indicator-thickness - Thickness of the progress indicator.
 * @cssprop --m3e-progress-indicator-track-color - Track color of the progress indicator (background).
 * @cssprop --m3e-circular-indeterminate-progress-indicator-track-color - Track color of the flat indeterminate indicator (defaults to transparent, as in AndroidX).
 * @cssprop --m3e-progress-indicator-color - Color of the progress indicator (foreground).
 */
@customElement("m3e-circular-progress-indicator")
export class M3eCircularProgressIndicatorElement extends ProgressElementIndicatorBase {
  /** The styles of the element. */
  static override styles: CSSResultGroup = [
    ProgressElementIndicatorBase.styles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        aspect-ratio: 1;
        position: relative;
        align-items: center;
        justify-content: center;
      }
      :host([hidden]) {
        display: none;
      }
      .progress {
      }
      .active-track {
        transition: stroke-dashoffset 500ms cubic-bezier(0, 0, 0.2, 1);
      }
      .flat-svg {
        overflow: visible;
        inset: 0;
      }
      .flat-svg .track {
        color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      :host([indeterminate]) .flat-svg .track {
        /* AndroidX: ProgressIndicatorDefaults.circularIndeterminateTrackColor = Transparent. */
        color: var(--m3e-circular-indeterminate-progress-indicator-track-color, transparent);
      }
      .flat-svg .active-track {
        color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      .wavy-svg {
        overflow: visible;
        inset: 0;
      }
      .wavy-svg .track {
        color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      .wavy-svg .active-track {
        color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
        transition: none;
      }
      :host(:is(:state(--flat), :--flat)) .progress {
        flex: 1;
        align-self: stretch;
        pointer-events: none;
      }
      .progress,
      .content {
        position: absolute;
        inset: 0;
      }
      .content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .diameter-and-stroke,
      .amplitude-and-wavelength {
        visibility: hidden;
        position: absolute;
      }
      .diameter-and-stroke {
        width: inherit;
        height: var(--m3e-circular-progress-indicator-thickness, 4px);
      }
      .amplitude-and-wavelength {
        width: var(--m3e-circular-wavy-progress-indicator-amplitude, 1.6px);
        height: var(--m3e-circular-wavy-progress-indicator-wavelength, 15px);
      }
      :host(:is(:state(--flat), :--flat)) {
        width: var(--m3e-circular-flat-progress-indicator-diameter, 40px);
      }
      :host(:is(:state(--wavy), :--wavy)) {
        width: var(--m3e-circular-wavy-progress-indicator-diameter, 48px);
      }
      .track {
        color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      .active-track {
        color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      @media (forced-colors: active) {
        :host(:is(:state(--flat), :--flat)) circle {
          fill: Canvas;
        }
      }
    `,
  ];

  /** @private */ #diameter = 0;
  /** @private */ #strokeWidth = 0;
  /** @private */ #amplitude = 0;
  /** @private */ #wavelength = 0;

  /** @private */ #activePath?: SVGPathElement | null;
  /** @private */ #trackPath?: SVGPathElement | null;

  /** @private Seconds since the wavy engine started animating (for wave phase / indeterminate). */
  #clock = 0;
  /** @private Current morph amplitude (0 = circle, 1 = star), eased. */
  #ampCurrent: number | null = null;
  /** @private In-flight amplitude tween. */
  #ampAnim: { from: number; to: number; elapsed: number; ease: (x: number) => number } | null = null;
  /** @private Wave phase 0..1. */
  #waveOffset = 0;
  /** @private Last frame delta in ms (for amplitude tween); falls back to ~16.7. */
  #lastDtMs = 16.7;

  /** @private The shared rounded-star sample cache (keyed by vertex count). */
  readonly #starCache = new Map<number, ReturnType<typeof roundedStarSamples>>();

  /** @private */ readonly #resizeController = new ResizeController(this, {
    skipInitial: true,
    target: null,
    callback: () => {
      this.#updateDiameterAndStroke();
      this.#updateAmplitudeAndWavelength();
      queueMicrotask(() => this.requestUpdate());
    },
  });

  /** @private The rAF loop driving both determinate (travelling wave) and indeterminate wavy. */
  readonly #wavyLoop = new AnimationLoopController(this, (dt) => this.#tickWavy(dt));

  // ── Flat (classic) engine state ──
  /** @private */ #flatActivePath?: SVGPathElement;
  /** @private */ #flatTrackPath?: SVGPathElement;
  /** @private Time base (ms) for the flat indeterminate animation. */
  #flatClock = 0;
  /** @private rAF loop for the flat indeterminate spinner. */
  readonly #flatLoop = new AnimationLoopController(this, (dt) => this.#tickFlat(dt));

  /** @private */ readonly #reducedMotion =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  /**
   * Whether to show something is happening without conveying progress.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) indeterminate = false;

  /** @inheritdoc */
  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has("indeterminate")) {
      this.ariaValueNow = this.indeterminate ? null : `${this.value}`;
    }
  }

  /** @inheritdoc */
  override reconnectedCallback(): void {
    super.reconnectedCallback();
    this.#initialize();
  }

  /** @inheritdoc */
  protected override firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.#initialize();
  }

  /** @private */
  #initialize(): void {
    const diameterAndStroke = this.shadowRoot?.querySelector<HTMLElement>(".diameter-and-stroke");
    if (diameterAndStroke) {
      this.#updateDiameterAndStroke();
      this.#resizeController.observe(diameterAndStroke);
    }

    const amplitudeAndWavelength = this.shadowRoot?.querySelector<HTMLElement>(".amplitude-and-wavelength");
    if (amplitudeAndWavelength) {
      this.#updateAmplitudeAndWavelength();
      this.#resizeController.observe(amplitudeAndWavelength);
    }

    if (this.variant === "wavy") {
      this.#syncWavyAnimation();
    } else {
      this.#flatActivePath = this.shadowRoot?.querySelector<SVGPathElement>(".active-track") ?? undefined;
      this.#flatTrackPath = this.shadowRoot?.querySelector<SVGPathElement>(".track") ?? undefined;
      this.#renderFlat();
      if (this.indeterminate) this.#flatLoop.start();
    }
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#wavyLoop.stop();
    this.#flatLoop.stop();
  }

  /** @inheritdoc */
  override updated(_changedProperties: PropertyValues<this>): void {
    super.updated(_changedProperties);

    if (_changedProperties.has("indeterminate")) {
      // Reset the amplitude tween so a mode switch starts cleanly.
      this.#ampCurrent = null;
      this.#ampAnim = null;
    }

    if (this.variant === "wavy") {
      this.#flatLoop.stop();
      this.#activePath = this.shadowRoot?.querySelector<SVGPathElement>(".active-track");
      this.#trackPath = this.shadowRoot?.querySelector<SVGPathElement>(".track");
      this.#syncWavyAnimation();
    } else {
      this.#wavyLoop.stop();
      this.#flatActivePath = this.shadowRoot?.querySelector<SVGPathElement>(".active-track") ?? undefined;
      this.#flatTrackPath = this.shadowRoot?.querySelector<SVGPathElement>(".track") ?? undefined;
      this.#renderFlat();
      if (this.indeterminate) this.#flatLoop.start();
      else this.#flatLoop.stop();
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return this.variant === "wavy" ? this.#renderWavyIndicator() : this.#renderFlatIndicator();
  }

  /** @private */
  #renderFlatIndicator(): unknown {
    const size = this.#diameter || 40;
    return html`<div class="progress" aria-hidden="true">
        <svg class="flat-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <path
            class="track"
            stroke="currentColor"
            stroke-width=${this.#strokeWidth}
            fill="none"
            stroke-linecap="round"
          />
          <path
            class="active-track"
            stroke="currentColor"
            stroke-width=${this.#strokeWidth}
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </div>
      ${this.#renderResizeObservedElements()}${this.#renderContent()}`;
  }

  /** @private Advance flat indeterminate one frame. */
  #tickFlat(dt: number): void {
    this.#flatClock += dt * 1000;
    this.#renderFlat();
  }

  /** @private Paint one frame of the flat (classic) circular indicator. */
  #renderFlat(): void {
    if (!this.#flatActivePath || !this.#flatTrackPath) return;
    const size = this.#diameter || 40;
    const strokeWidth = this.#strokeWidth || 4;
    const gap = this.#strokeWidth || 4;
    let active: Arc;
    let track: Arc;

    if (this.indeterminate) {
      const st = indeterminateState(this.#flatClock);
      ({ active, track } = classicCircularIndeterminate(st.sweep, st.rotationDeg - 90, size, strokeWidth, gap, true));
    } else {
      const progress = this.max > 0 ? Math.min(1, Math.max(0, this.value / this.max)) : 0;
      ({ active, track } = classicCircularDeterminate(progress, size, strokeWidth, gap, true));
    }

    const cx = size / 2;
    const cy = size / 2;
    this.#flatActivePath.setAttribute("d", arcToPath(active, cx, cy));
    this.#flatTrackPath.setAttribute("d", arcToPath(track, cx, cy));
  }

  /** @private */
  #renderWavyIndicator(): unknown {
    // The engine draws into a `size`-square coordinate space; pad the viewBox by stroke + amplitude
    // so the wave and rounded caps never clip at the outer edge.
    const size = this.#diameter || 48;
    const pad = (this.#strokeWidth || 4) + (this.#amplitude || 0);
    return html`
      <svg
        class="progress wavy-svg"
        width="${size}"
        height="${size}"
        viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}"
        aria-hidden="true"
      >
        <path
          class="track"
          stroke="currentColor"
          stroke-width=${this.#strokeWidth}
          fill="none"
          stroke-linecap="round"
        />
        <path
          class="active-track"
          stroke="currentColor"
          stroke-width=${this.#strokeWidth}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      ${this.#renderResizeObservedElements()}${this.#renderContent()}
    `;
  }

  /** @private */
  #renderResizeObservedElements(): unknown {
    return html`<div class="diameter-and-stroke" aria-hidden="true"></div>
      <div class="amplitude-and-wavelength" aria-hidden="true"></div>`;
  }

  /** @private */
  #renderContent(): unknown {
    return html`<div class="content" aria-hidden="true"><slot></slot></div>`;
  }

  /** @private */
  #updateDiameterAndStroke(): void {
    const element = this.shadowRoot?.querySelector<HTMLElement>(".diameter-and-stroke");
    if (element) {
      this.#diameter = element.clientWidth;
      this.#strokeWidth = element.clientHeight;
    }
  }

  /** @private */
  #updateAmplitudeAndWavelength(): void {
    const element = this.shadowRoot?.querySelector<HTMLElement>(".amplitude-and-wavelength");
    if (element) {
      this.#amplitude = element.clientWidth;
      this.#wavelength = element.clientHeight;
    }
  }

  /** @private Options for the circular wavy engine, derived from the measured geometry. */
  #wavyOptions(): CircularWavyOptions {
    return {
      size: this.#diameter || 48,
      stroke: this.#strokeWidth || 4,
      trackStroke: this.#strokeWidth || 4,
      gap: this.#strokeWidth || 4,
      wavelength: this.#wavelength || 15,
    };
  }

  /** @private Vertex count for the current geometry (for the wave-speed period). */
  #wavyVertexCount(): number {
    const o = this.#wavyOptions();
    return circularVertexCount(o.size, o.stroke, o.wavelength);
  }

  /** @private Start the rAF loop when the wavy variant should animate. */
  #syncWavyAnimation(): void {
    if (this.variant !== "wavy") {
      this.#wavyLoop.stop();
      return;
    }
    if (this.#reducedMotion?.matches) {
      // Reduced motion: render a single static frame, no travelling wave.
      this.#waveOffset = 0;
      this.#renderWavy();
      this.#wavyLoop.stop();
      return;
    }
    this.#wavyLoop.start();
  }

  /** @private Advance the wavy animation one frame and repaint. */
  #tickWavy(dt: number): void {
    if (this.variant !== "wavy") return;
    this.#lastDtMs = dt * 1000;
    this.#clock += dt;
    // Wave phase: one wavelength per second per vertex (AndroidX waveSpeed == wavelength).
    const n = Math.max(1, this.#wavyVertexCount());
    this.#waveOffset = (this.#waveOffset + dt / n) % 1;
    this.#renderWavy();
  }

  /** @private Paint one frame of the wavy indicator into the two SVG paths. */
  #renderWavy(): void {
    if (!this.#activePath || !this.#trackPath) return;
    const opts = this.#wavyOptions();
    let progress: number;
    let amplitude: number;
    let rotationDeg = 0;

    if (this.indeterminate) {
      const st = indeterminateState(this.#clock * 1000);
      progress = st.sweep;
      amplitude = st.amplitude;
      rotationDeg = st.rotationDeg;
    } else {
      progress = this.max > 0 ? Math.min(1, Math.max(0, this.value / this.max)) : 0;
      amplitude = this.#resolveAmplitude(progress);
    }

    const paths = generateCircularWavyPath(
      progress,
      amplitude,
      opts,
      this.#waveOffset,
      rotationDeg,
      this.#starCache,
    );
    this.#activePath.setAttribute("d", paths.active);
    this.#trackPath.setAttribute("d", paths.track);
  }

  /**
   * @private Resolve the determinate morph amplitude with a 500ms tween toward the target
   * (rise: Standard, fall: EmphasizedAccelerate), matching AndroidX.
   */
  #resolveAmplitude(progress: number): number {
    const target = determinateAmplitude(progress);
    if (this.#ampCurrent === null) {
      this.#ampCurrent = target;
      return target;
    }
    if (this.#ampAnim) {
      const k = Math.min(1, this.#ampAnim.elapsed / 500);
      this.#ampCurrent = this.#ampAnim.from + (this.#ampAnim.to - this.#ampAnim.from) * this.#ampAnim.ease(k);
      this.#ampAnim.elapsed += this.#lastDtMs;
      if (k >= 1) {
        this.#ampCurrent = this.#ampAnim.to;
        this.#ampAnim = null;
      }
    } else if (Math.abs(target - this.#ampCurrent) > 1e-6) {
      this.#ampAnim = {
        from: this.#ampCurrent,
        to: target,
        elapsed: 0,
        ease: this.#ampCurrent < target ? easeStandard : easeEmphasizedAccelerate,
      };
    }
    return this.#ampCurrent;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-circular-progress-indicator": M3eCircularProgressIndicatorElement;
  }
}
