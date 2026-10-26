import { css, CSSResultGroup, html, nothing, PropertyValues, svg } from "lit";
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
        --_arc-duration: 1333ms;
        --_cycle-duration: calc(4 * var(--_arc-duration));
        --_linear-rotate-duration: calc(var(--_arc-duration) * 360 / 306);
        --_indeterminate-easing: cubic-bezier(0.4, 0, 0.2, 1);
      }
      .active-track {
        transition: stroke-dashoffset 500ms cubic-bezier(0, 0, 0.2, 1);
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
      .spinner,
      .left,
      .right,
      .content,
      .circle {
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
      :host(:is(:state(--flat), :--flat)[indeterminate]) .progress {
        animation: linear infinite linear-rotate;
        animation-duration: var(--_linear-rotate-duration);
      }
      :host(:is(:state(--flat), :--flat)[indeterminate]) .spinner {
        animation: infinite both rotate-arc;
        animation-duration: var(--_cycle-duration);
        animation-timing-function: var(--_indeterminate-easing);
      }
      .left {
        clip-path: inset(0);
        inset: 0 50% 0 0;
      }
      .right {
        clip-path: inset(0);
        inset: 0 0 0 50%;
      }
      .circle {
        animation: expand-arc;
        animation-iteration-count: infinite;
        animation-fill-mode: both;
        animation-duration: var(--_arc-duration), var(--_cycle-duration);
        animation-timing-function: var(--_indeterminate-easing);
      }
      .left .circle {
        rotate: 135deg;
        inset: 0 -100% 0 0;
      }
      .right .circle {
        rotate: 100deg;
        inset: 0 0 0 -100%;
        animation-delay: calc(-0.5 * var(--_arc-duration)), 0ms;
      }
      .track {
        color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      .active-track {
        color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      @keyframes expand-arc {
        0% {
          transform: rotate(265deg);
        }
        50% {
          transform: rotate(130deg);
        }
        100% {
          transform: rotate(265deg);
        }
      }
      @keyframes rotate-arc {
        12.5% {
          transform: rotate(135deg);
        }
        25% {
          transform: rotate(270deg);
        }
        37.5% {
          transform: rotate(405deg);
        }
        50% {
          transform: rotate(540deg);
        }
        62.5% {
          transform: rotate(675deg);
        }
        75% {
          transform: rotate(810deg);
        }
        87.5% {
          transform: rotate(945deg);
        }
        100% {
          transform: rotate(1080deg);
        }
      }
      @keyframes linear-rotate {
        to {
          transform: rotate(360deg);
        }
      }
      @media (forced-colors: active) {
        :host(:is(:state(--flat), :--flat)) circle {
          fill: Canvas;
        }
        :host(:is(:state(--flat), :--flat)) .circle {
          border-color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary})
            var(--m3e-progress-indicator-color, ${DesignToken.color.primary}) Canvas Canvas;
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

    if (this.variant === "wavy") this.#syncWavyAnimation();
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#wavyLoop.stop();
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
      this.#activePath = this.shadowRoot?.querySelector<SVGPathElement>(".active-track");
      this.#trackPath = this.shadowRoot?.querySelector<SVGPathElement>(".track");
      this.#syncWavyAnimation();
    } else {
      this.#wavyLoop.stop();
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return this.variant === "wavy" ? this.#renderWavyIndicator() : this.#renderFlatIndicator();
  }

  /** @private */
  #renderFlatIndicator(): unknown {
    if (this.indeterminate) {
      const left = this.#drawArc({ startAngle: -45, endAngle: 90 + this.#strokeWidth });
      const right = this.#drawArc({ startAngle: -this.#strokeWidth, endAngle: 135 });

      return html`<div class="progress" aria-hidden="true">
          <div class="spinner">
            <div class="left">
              <svg width="${this.#diameter}" height="${this.#diameter}" viewBox="${left.viewBox}" class="circle">
                <path
                  class="active-track"
                  d="${left.path}"
                  stroke="currentColor"
                  stroke-width=${this.#strokeWidth}
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="right">
              <svg width="${this.#diameter}" height="${this.#diameter}" viewBox="${right.viewBox}" class="circle">
                <path
                  class="active-track"
                  d="${right.path}"
                  stroke="currentColor"
                  stroke-width=${this.#strokeWidth}
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
        ${this.#renderResizeObservedElements()}`;
    }

    const minDegrees = this.#sizeToDegrees(this.#strokeWidth * 2, this.#diameter);
    let degrees = (this.value / this.max) * 360;
    if (degrees > 0) {
      degrees = Math.max(0, minDegrees, degrees);
    }

    const active = this.#drawArc({ gap: degrees < 360 ? this.#strokeWidth : 0, endAngle: degrees });
    const inactive = this.#drawArc({ gap: degrees > 0 ? this.#strokeWidth : 0, startAngle: degrees, endAngle: 360 });

    return html`<div class="progress" aria-hidden="true">
        <svg width="${this.#diameter}" height="${this.#diameter}" viewBox="${active.viewBox}">
          ${degrees > 0
            ? svg`<path
            class="active-track"
            d="${active.path}"
            stroke="currentColor"
            stroke-width=${this.#strokeWidth}
            fill="none"
            stroke-linecap="round"
          />`
            : nothing}
          ${360 - degrees >= minDegrees
            ? svg`<path
                class="track"
                d="${inactive.path}"
                stroke="currentColor"
                stroke-width=${this.#strokeWidth}
                fill="none"
                stroke-linecap="round"
              />`
            : nothing}
        </svg>
      </div>
      ${this.#renderResizeObservedElements()}${this.#renderContent()}`;
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

  /** @private */
  #sizeToDegrees(size: number, padding = this.#amplitude): number {
    return size * (360 / (2 * Math.PI * this.#computeCircle(padding).r));
  }

  /** @private */
  #degreesToRadians(degrees: number) {
    return (degrees - 90) * (Math.PI / 180);
  }

  /** @private */
  #polarToCartesian(circle: { cx: number; cy: number; r: number }, degrees: number) {
    const rad = this.#degreesToRadians(degrees);
    return {
      x: circle.cx + circle.r * Math.cos(rad),
      y: circle.cy + circle.r * Math.sin(rad),
    };
  }

  /** @private */
  #computeCircle(padding: number) {
    padding = padding + this.#strokeWidth / 2;
    const r = this.#diameter / 2;
    const cx = r + padding;
    const cy = r + padding;
    return { cx, cy, r, padding };
  }

  /** @private */
  #drawArc({
    startAngle = 0,
    endAngle = 360,
    gap = 0,
    padding = this.#amplitude,
  }: {
    startAngle?: number;
    endAngle?: number;
    gap?: number;
    padding?: number;
  }) {
    if (this.#diameter === 0 || this.#strokeWidth === 0) return { path: "", viewBox: "0 0 0 0" };

    const circle = this.#computeCircle(padding);
    if (gap > 0) {
      startAngle += this.#sizeToDegrees(gap, padding);
      endAngle -= this.#sizeToDegrees(gap, padding);
    }
    if (endAngle - startAngle >= 360) {
      endAngle = startAngle + 359.999;
    }
    const start = this.#polarToCartesian(circle, endAngle);
    const end = this.#polarToCartesian(circle, startAngle);

    const path = `M ${start.x} ${start.y} A ${circle.r} ${circle.r} 0 ${endAngle - startAngle <= 180 ? "0" : "1"} 0 ${end.x} ${end.y}`;
    const viewBox = `0 0 ${this.#diameter + circle.padding * 2} ${this.#diameter + circle.padding * 2}`;
    return { path, viewBox };
  }

}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-circular-progress-indicator": M3eCircularProgressIndicatorElement;
  }
}
