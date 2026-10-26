import { css, CSSResultGroup, html, nothing, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import {
  AnimationLoopController,
  customElement,
  DesignToken,
  ResizeController,
  safeStyleMap,
  setCustomEnumState,
} from "@wanjie/m3e-web/core";
import { M3eDirectionality, SupportsDirectionality } from "@wanjie/m3e-web/core/bidi";

import {
  classicLinearDeterminate,
  classicLinearIndeterminate,
  spanToLine,
  type StopBox,
} from "./classic-progress";
import { isLinearProgressMode, LinearProgressMode } from "./LinearProgressMode";
import { ProgressElementIndicatorBase } from "./ProgressElementIndicatorBase";
import { defaultAmplitudeForProgress, linearIndeterminateFractions, WaveDriver, type WaveFrame } from "./wavy";

/**
 * A horizontal bar for indicating progress and activity.
 *
 * @description
 * The `m3e-linear-progress-indicator` component displays a horizontal progress bar for tracking
 * the completion of a task or process. It supports `determinate`, `indeterminate`, `buffer`,
 * and `query` modes, and can be customized with CSS custom properties for thickness, shape, and color.
 * The component is accessible, animates smoothly, and adapts to various use cases including loading,
 * buffering, and activity indication.
 *
 * @example
 * The following example illustrates a determinate linear progress indicator.
 * ```html
 * <m3e-linear-progress-indicator value="30"></m3e-linear-progress-indicator>
 * ```
 * @example
 * The next example illustrates an indeterminate linear progress indicator using the `mode` attribute.
 * ```html
 * <m3e-linear-progress-indicator mode="indeterminate"></m3e-linear-progress-indicator>
 * ```
 *
 * @tag m3e-linear-progress-indicator
 *
 * @attr buffer-value - A fractional value, between 0 and `max`, indicating buffer progress.
 * @attr max - The maximum progress value.
 * @attr mode - The mode of the progress bar.
 * @attr value - A fractional value, between 0 and `max`, indicating progress.
 * @attr variant - The appearance of the indicator.
 *
 * @cssprop --m3e-linear-progress-indicator-thickness - Thickness (height) of the progress bar.
 * @cssprop --m3e-linear-progress-indicator-shape - Border radius of the progress bar.
 * @cssprop --m3e-progress-indicator-track-color - Track color of the progress bar (background/buffer).
 * @cssprop --m3e-progress-indicator-color - Color of the progress indicator (foreground).
 * @cssprop --m3e-linear-wavy-progress-indicator-amplitude - Amplitude of the `wavy` variant.
 * @cssprop --m3e-linear-wavy-progress-indicator-wavelength - Wavelength of the `wavy` variant.
 * @cssprop --m3e-linear-wavy-indeterminate-progress-indicator-wavelength - Wavelength of the indeterminate/query `wavy` variant.
 */
@customElement("m3e-linear-progress-indicator")
export class M3eLinearProgressIndicatorElement extends SupportsDirectionality(ProgressElementIndicatorBase) {
  /** The styles of the element. */
  static override styles: CSSResultGroup = [
    ProgressElementIndicatorBase.styles,
    css`
      :host {
        display: block;
        position: relative;
      }
      .progress {
        width: 100%;
        height: 100%;
        position: relative;
        align-items: center;
        border-radius: var(--m3e-linear-progress-indicator-shape, ${DesignToken.shape.corner.extraSmall});
      }
      .stroke,
      .amplitude-and-wavelength {
        visibility: hidden;
        position: absolute;
      }
      .stroke {
        width: 100%;
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
      }
      .amplitude-and-wavelength {
        height: var(--m3e-linear-wavy-progress-indicator-amplitude, 3px);
        width: var(--m3e-linear-wavy-progress-indicator-wavelength, 40px);
      }
      :host(:is(:state(--indeterminate), :--indeterminate)) .amplitude-and-wavelength,
      :host(:is(:state(--query), :--query)) .amplitude-and-wavelength {
        width: var(--m3e-linear-wavy-indeterminate-progress-indicator-wavelength, 24px);
      }
      .primary,
      .secondary,
      .stop {
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
        border-radius: inherit;
      }
      .stop {
        aspect-ratio: 1;
        flex: none;
      }
      :host(:is(:state(--flat), :--flat)) {
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
      }
      :host(:is(:state(--wavy), :--wavy)) {
        height: calc(
          var(--m3e-linear-progress-indicator-thickness, 4px) +
            calc(var(--m3e-linear-wavy-progress-indicator-amplitude, 3px) * 2)
        );
      }
      :host(:is(:state(--wavy), :--wavy)) .primary,
      :host(:is(:state(--wavy), :--wavy)) .secondary {
        position: relative;
        height: 100%;
        overflow: hidden;
      }
      :host(:is(:state(--wavy), :--wavy)) .complete {
        position: absolute;
        margin: auto;
        top: calc(50% - calc(var(--m3e-linear-progress-indicator-thickness, 4px) / 2));
        left: 0;
        right: 0;
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
        border-radius: inherit;
      }
      :host(:is(:state(--wavy), :--wavy)) .secondary {
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
      }
      .flat-canvas {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .flat-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .flat-svg .flat-active {
        stroke: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      .flat-svg .flat-track {
        stroke: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      .flat-svg .flat-stop {
        fill: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      .wavy-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
        pointer-events: none;
      }
      .wavy-canvas .wavy-active {
        stroke: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      .wavy-canvas .wavy-track {
        stroke: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      .wavy-canvas .wavy-stop {
        fill: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      :host(:is(:state(--wavy), :--wavy)) .stop,
      :host(:is(:state(--wavy), :--wavy)) .complete,
      :host(:is(:state(--wavy), :--wavy)) .primary,
      :host(:is(:state(--wavy), :--wavy)) .secondary,
      :host(:is(:state(--wavy), :--wavy)) .gap,
      :host(:is(:state(--wavy), :--wavy)) .track {
        display: none;
      }
      :host(:is(:state(--determinate), :--determinate)) .progress,
      :host(:is(:state(--buffer), :--buffer)) .progress {
        display: flex;
        overflow: hidden;
      }
      :host(:is(:state(--determinate), :--determinate)) .primary,
      :host(:is(:state(--buffer), :--buffer)) .primary {
        width: var(--_value, 0px);
        flex: none;
      }
      :host(:is(:state(--determinate), :--determinate)) .gap,
      :host(:is(:state(--buffer), :--buffer)) .gap {
        flex-basis: var(--m3e-linear-progress-indicator-thickness, 4px);
        flex-shrink: 1;
      }
      :host(:is(:state(--determinate), :--determinate)) .secondary,
      :host(:is(:state(--buffer), :--buffer)) .buffer {
        flex: 1 1 auto;
      }
      :host(:is(:state(--buffer), :--buffer)) .buffer {
        flex-shrink: 5;
        height: 100%;
        width: 100%;
        background-color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
        mask-image: radial-gradient(
          circle,
          black 0,
          black calc(var(--m3e-linear-progress-indicator-thickness, 4px) / 2),
          transparent calc(var(--m3e-linear-progress-indicator-thickness, 4px) / 2)
        );
        mask-size: calc(var(--m3e-linear-progress-indicator-thickness, 4px) * 2) 100%;
        mask-repeat: repeat;
        animation: buffer 250ms linear infinite;
      }
      :host(:is(:state(--rtl), :--rtl):is(:state(--buffer), :--buffer)) .buffer {
        transform: scaleX(-1);
      }
      @keyframes buffer {
        from {
          mask-position: 0 0;
        }
        to {
          mask-position: calc(-1 * calc(var(--m3e-linear-progress-indicator-thickness, 4px) * 2)) 0;
        }
      }
      :host(:is(:state(--buffer), :--buffer)) .secondary {
        width: var(--_buffer-value, 0px);
        flex: none;
      }
      :host(:is(:state(--indeterminate), :--indeterminate)) .primary,
      :host(:is(:state(--query), :--query)) .primary {
        position: absolute;
        top: 0;
        height: 100%;
        border-radius: inherit;
        animation: indeterminate-primary 2.1s infinite linear;
      }
      :host(:is(:state(--wavy), :--wavy):is(:state(--indeterminate), :--indeterminate)) .primary,
      :host(:is(:state(--wavy), :--wavy):is(:state(--query), :--query)) .primary {
        animation-name: wavy-indeterminate-primary;
      }
      :host(:is(:state(--indeterminate), :--indeterminate)) .secondary,
      :host(:is(:state(--query), :--query)) .secondary {
        position: absolute;
        top: 0;
        height: 100%;
        border-radius: inherit;
        animation: indeterminate-secondary 2.1s infinite linear;
        animation-delay: 1.15s;
        animation-fill-mode: backwards;
      }
      :host(:is(:state(--wavy), :--wavy):is(:state(--indeterminate), :--indeterminate)) .secondary,
      :host(:is(:state(--wavy), :--wavy):is(:state(--query), :--query)) .secondary {
        animation-name: wavy-indeterminate-secondary;
      }
      :host(:is(:state(--indeterminate), :--indeterminate)) .progress,
      :host(:is(:state(--query), :--query)) .progress {
        overflow: hidden;
        position: relative;
      }
      :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--query), :--query)) .progress,
      :host(:is(:state(--rtl), :--rtl):is(:state(--indeterminate), :--indeterminate)) .progress {
        transform: scaleX(-1);
      }
      :host(:is(:state(--flat), :--flat)) .primary,
      :host(:is(:state(--flat), :--flat):is(:state(--indeterminate), :--indeterminate)) .secondary,
      :host(:is(:state(--flat), :--flat):is(:state(--query), :--query)) .secondary,
      :host(:is(:state(--wavy), :--wavy)) .complete,
      .stop {
        background-color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      :host(:is(:state(--wavy), :--wavy)) .progress {
        color: var(--m3e-progress-indicator-color, ${DesignToken.color.primary});
      }
      :host(:is(:state(--determinate), :--determinate)) .secondary,
      :host(:is(:state(--buffer), :--buffer)) .secondary,
      :host(:is(:state(--flat), :--flat):is(:state(--indeterminate), :--indeterminate)) .track,
      :host(:is(:state(--flat), :--flat):is(:state(--query), :--query)) .track {
        background-color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      :host(:is(:state(--wavy), :--wavy):is(:state(--indeterminate), :--indeterminate)) .track,
      :host(:is(:state(--wavy), :--wavy):is(:state(--query), :--query)) .track {
        color: var(--m3e-progress-indicator-track-color, ${DesignToken.color.secondaryContainer});
      }
      :host(:is(:state(--wavy), :--wavy):is(:state(--indeterminate), :--indeterminate)) .track,
      :host(:is(:state(--wavy), :--wavy):is(:state(--query), :--query)) .track {
        y: calc(50% - calc(var(--m3e-linear-progress-indicator-thickness, 4px) / 2));
        border-radius: inherit;
      }
      :host(:is(:state(--flat), :--flat):is(:state(--indeterminate), :--indeterminate)) .track,
      :host(:is(:state(--flat), :--flat):is(:state(--query), :--query)) .track {
        position: absolute;
        margin: auto;
        top: calc(50% - calc(var(--m3e-linear-progress-indicator-thickness, 4px) / 2));
        left: 0;
        right: 0;
        height: var(--m3e-linear-progress-indicator-thickness, 4px);
        border-radius: inherit;
      }
      @keyframes indeterminate-primary {
        0% {
          left: -145.167%;
          width: 8%;
        }
        20% {
          left: -113.333%;
          width: 48%;
        }
        60% {
          left: 56.333%;
          width: 78%;
        }
        100% {
          left: 100%;
          width: 8%;
        }
      }
      @keyframes indeterminate-secondary {
        0% {
          left: -54.888%;
          width: 8%;
        }
        20% {
          left: -20%;
          width: 48%;
        }
        60% {
          left: 60%;
          width: 78%;
        }
        100% {
          left: 160%;
          width: 8%;
        }
      }
      @keyframes wavy-indeterminate-primary {
        0% {
          transform: translateX(-145.167%);
          width: 8%;
        }
        20% {
          transform: translateX(-113.333%);
          width: 48%;
        }
        60% {
          transform: translateX(56.333%);
          width: 78%;
        }
        100% {
          transform: translateX(100%);
          width: 8%;
        }
      }
      @keyframes wavy-indeterminate-secondary {
        0% {
          transform: translateX(-54.888%);
          width: 8%;
        }
        20% {
          transform: translateX(-20%);
          width: 48%;
        }
        60% {
          transform: translateX(60%);
          width: 78%;
        }
        100% {
          transform: translateX(160%);
          width: 8%;
        }
      }
    `,
  ];

  /** @private */ #strokeWidth = 0;
  /** @private */ #amplitude = 0;
  /** @private */ #wavelength = 0;

  /** @private The rAF engine that drives the wavy variant. */
  #waveDriver?: WaveDriver;
  /** @private The SVG path elements the driver paints into. */
  #activePath?: SVGPathElement;
  /** @private */ #trackPath?: SVGPathElement;
  /** @private */ #stopCircle?: SVGCircleElement;
  /** @private */ #prefersReducedMotion?: MediaQueryList;
  /** @private */ #onReducedMotionChange = (): void => {
    this.#waveDriver?.setReducedMotion(this.#prefersReducedMotion?.matches ?? false);
    this.#syncWaveDriver();
  };

  // ── Flat (classic) engine state ──
  /** @private Flat SVG path handles. */
  #flatActivePath?: SVGPathElement;
  /** @private */ #flatTrackPath?: SVGPathElement;
  /** @private */ #flatStop?: SVGRectElement;
  /** @private Time base (ms) for the flat indeterminate fraction cycle. */
  #flatClock = 0;
  /** @private rAF loop for flat indeterminate/query. */
  readonly #flatLoop = new AnimationLoopController(this, (dt) => this.#tickFlat(dt));

  /** @private */ readonly #resizeController = new ResizeController(this, {
    skipInitial: true,
    target: null,
    callback: () => {
      this.#updateStroke();
      this.#updateAmplitudeAndWavelength();
      queueMicrotask(() => {
        this.requestUpdate();
        if (this.variant === "wavy") this.#syncWaveDriver();
      });
    },
  });

  /**
   * The mode of the progress bar.
   * @default "determinate"
   */
  @property({ reflect: true, useDefault: true }) mode: LinearProgressMode = "determinate";

  /**
   * A fractional value, between 0 and `max`, indicating buffer progress.
   * @default 0
   */
  @property({ attribute: "buffer-value", type: Number }) bufferValue = 0;

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();
    this.#applyMode();
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#prefersReducedMotion?.removeEventListener("change", this.#onReducedMotionChange);
    this.#waveDriver?.stop();
    this.#flatLoop.stop();
  }

  /** @inheritdoc */
  override reconnectedCallback(): void {
    super.reconnectedCallback();
    this.#initialize();
  }

  /** @inheritdoc */
  protected override willUpdate(_changedProperties: PropertyValues<this>): void {
    super.willUpdate(_changedProperties);

    if (_changedProperties.has("mode")) {
      this.#applyMode();
    }
  }

  /** @inheritdoc */
  protected override firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.#initialize();
  }

  /** @private */
  #applyMode(): void {
    if (!isLinearProgressMode(this.mode)) {
      this.mode = "determinate";
    }
    setCustomEnumState(this, this.mode, "buffer", "determinate", "indeterminate", "query");
  }

  /** @private */
  #initialize(): void {
    this.#updateStroke();
    this.#updateAmplitudeAndWavelength();

    const stroke = this.shadowRoot?.querySelector<HTMLElement>(".stroke");
    if (stroke) {
      this.#resizeController.observe(stroke);
    }

    const amplitudeAndWavelength = this.shadowRoot?.querySelector<HTMLElement>(".amplitude-and-wavelength");
    if (amplitudeAndWavelength) {
      this.#resizeController.observe(amplitudeAndWavelength);
    }

    if (this.variant === "wavy") {
      this.#startWave();
    } else if (this.mode !== "buffer") {
      this.#flatActivePath = this.shadowRoot?.querySelector<SVGPathElement>(".flat-active") ?? undefined;
      this.#flatTrackPath = this.shadowRoot?.querySelector<SVGPathElement>(".flat-track") ?? undefined;
      this.#flatStop = this.shadowRoot?.querySelector<SVGRectElement>(".flat-stop") ?? undefined;
      this.#renderFlat();
      if (this.#flatIsIndeterminate()) this.#flatLoop.start();
    }
  }

  /** @inheritdoc */
  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has("mode")) {
      this.ariaValueNow = this.mode === "indeterminate" || this.mode === "query" ? null : `${this.value}`;
    }
  }

  /** @inheritdoc */
  protected override updated(_changedProperties: PropertyValues<this>): void {
    super.updated(_changedProperties);

    if (_changedProperties.has("value") || _changedProperties.has("bufferValue") || _changedProperties.has("max")) {
      const progress = this.shadowRoot?.querySelector<HTMLElement>(".progress");
      progress?.style.setProperty("--_value", `${(this.value / this.max) * 100}%`);
      progress?.style.setProperty("--_buffer-value", `${(this.bufferValue / this.max) * 100}%`);
    }

    if (this.variant === "wavy") {
      this.#flatLoop.stop();
      if (
        _changedProperties.has("variant") ||
        _changedProperties.has("value") ||
        _changedProperties.has("max") ||
        _changedProperties.has("bufferValue")
      ) {
        this.#startWave();
      }
    } else {
      this.#stopWave();
      if (this.mode === "buffer") {
        this.#flatLoop.stop();
        return;
      }
      this.#flatActivePath = this.shadowRoot?.querySelector<SVGPathElement>(".flat-active") ?? undefined;
      this.#flatTrackPath = this.shadowRoot?.querySelector<SVGPathElement>(".flat-track") ?? undefined;
      this.#flatStop = this.shadowRoot?.querySelector<SVGRectElement>(".flat-stop") ?? undefined;
      this.#renderFlat();
      if (this.#flatIsIndeterminate()) this.#flatLoop.start();
      else this.#flatLoop.stop();
    }
  }

  /** @private */ #flatIsIndeterminate(): boolean {
    return this.mode === "indeterminate" || this.mode === "query";
  }

  /** @private Advance flat indeterminate one frame. */
  #tickFlat(dt: number): void {
    this.#flatClock += dt * 1000;
    this.#renderFlat();
  }

  /** @private Paint one frame of the flat (classic) linear indicator. */
  #renderFlat(): void {
    const host = this.shadowRoot?.querySelector<HTMLElement>(".progress");
    if (!host || !this.#flatActivePath || !this.#flatTrackPath) return;
    const width = host.clientWidth;
    const height = this.#strokeWidth || 4;
    const gap = this.#strokeWidth || 4;
    const stopSize = this.#strokeWidth || 4;
    const round = true;
    const rtl = M3eDirectionality.current === "rtl";

    let active: string[];
    let tracks: string[];
    let stop: StopBox | null = null;

    if (this.#flatIsIndeterminate()) {
      // linearIndeterminateFractions() emits [firstTail, firstHead, secondTail, secondHead] (wavy
      // order); the classic engine takes [firstHead, firstTail, secondHead, secondTail].
      const [firstTail, firstHead, secondTail, secondHead] = linearIndeterminateFractions(this.#flatClock);
      // Direction for indeterminate/query is handled by the `.progress { transform: scaleX(-1) }` rules
      // (RTL indeterminate, LTR query), so the engine always lays out LTR to avoid a double flip.
      const layout = classicLinearIndeterminate([firstHead, firstTail, secondHead, secondTail], width, height, gap, round, false);
      active = layout.active.map((s) => spanToLine(s, height / 2));
      tracks = layout.tracks.map((s) => spanToLine(s, height / 2));
    } else {
      const progress = this.max > 0 ? Math.min(1, Math.max(0, this.value / this.max)) : 0;
      const layout = classicLinearDeterminate(progress, width, height, gap, stopSize, round, rtl);
      active = layout.active.map((s) => spanToLine(s, height / 2));
      tracks = layout.tracks.map((s) => spanToLine(s, height / 2));
      stop = progress > 0 ? layout.stop : null;
    }

    this.#flatActivePath.setAttribute("d", active.join(" "));
    this.#flatTrackPath.setAttribute("d", tracks.join(" "));
    this.#flatActivePath.setAttribute("stroke-width", `${height}`);
    this.#flatTrackPath.setAttribute("stroke-width", `${height}`);

    if (this.#flatStop) {
      if (stop) {
        this.#flatStop.setAttribute("x", `${stop.x - stop.size / 2}`);
        this.#flatStop.setAttribute("y", `${stop.y - stop.size / 2}`);
        this.#flatStop.setAttribute("width", `${stop.size}`);
        this.#flatStop.setAttribute("height", `${stop.size}`);
        this.#flatStop.setAttribute("rx", stop.round ? `${stop.size / 2}` : "0");
        this.#flatStop.style.display = "";
      } else {
        this.#flatStop.style.display = "none";
      }
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    if (this.variant === "wavy") {
      return html`<div class="progress" aria-hidden="true">
          <svg class="wavy-canvas">
            <path class="wavy-track" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            <path class="wavy-active" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle class="wavy-stop" r="0"></circle>
          </svg>
        </div>
        ${this.#renderResizeObservedElements()}`;
    }

    if (this.mode === "buffer") {
      return this.#renderFlatBuffer();
    }

    // Determinate / indeterminate / query: flat SVG driven by the classic engine.
    return html`<div class="progress flat-canvas" aria-hidden="true">
        <svg class="flat-svg">
          <path class="flat-track" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
          <path class="flat-active" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
          <rect class="flat-stop" width="0" height="0"></rect>
        </svg>
      </div>
      ${this.#renderResizeObservedElements()}`;
  }

  /** @private Legacy buffer-mode rendering (m3e-specific; no AndroidX classic equivalent). */
  #renderFlatBuffer(): unknown {
    const clampedValue = Math.max(0, Math.min(this.value, this.max));
    const activeWidth = (clampedValue / this.max) * this.clientWidth;

    return html`<div
        class="progress"
        aria-hidden="true"
        style="${safeStyleMap({
          "--_translate-x": `-${activeWidth}px`,
        })}"
      >
        <div class="track"></div>
        ${this.value <= 0
          ? nothing
          : html`<div class="primary"></div>
              <div class="gap"></div>`}
        ${this.bufferValue > 0 ? html`<div class="secondary"></div>` : nothing}
        ${this.bufferValue > 0 ? html`<div class="gap"></div>` : nothing}
        <div class="buffer"></div>
        ${this.value > 0 ? html`<div class="gap"></div><div class="stop"></div>` : nothing}
      </div>
      ${this.#renderResizeObservedElements()}`;
  }

  /** @private */
  #renderResizeObservedElements(): unknown {
    return html`<div class="stroke" aria-hidden="true"></div>
      <div class="amplitude-and-wavelength" aria-hidden="true"></div>`;
  }

  /** @private */
  #updateStroke(): void {
    const element = this.shadowRoot?.querySelector<HTMLElement>(".stroke");
    if (element) {
      this.#strokeWidth = element.clientHeight;
    }
  }

  /** @private */
  #updateAmplitudeAndWavelength(): void {
    const element = this.shadowRoot?.querySelector<HTMLElement>(".amplitude-and-wavelength");
    if (element) {
      this.#amplitude = element.clientHeight;
      this.#wavelength = element.clientWidth;
    }
  }

  // ── Wavy engine glue ──────────────────────────────────────────────────────────────────────────

  /** @private Ensure the wave driver exists and grab the path handles for the current render. */
  #initWaveDriver(): void {
    if (!this.#waveDriver) {
      this.#waveDriver = new WaveDriver({
        width: 0,
        height: 0,
        stroke: this.#strokeWidth,
        trackStroke: this.#strokeWidth,
        wavelength: this.#wavelength,
        cap: "round",
        trackCap: "round",
        gap: this.#strokeWidth,
        stopSize: this.#strokeWidth,
        onFrame: (frame) => this.#paintWave(frame),
      });
      this.#prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.#prefersReducedMotion.addEventListener("change", this.#onReducedMotionChange);
      this.#waveDriver.setReducedMotion(this.#prefersReducedMotion.matches);
    }
    this.#activePath = this.shadowRoot?.querySelector<SVGPathElement>(".wavy-active") ?? undefined;
    this.#trackPath = this.shadowRoot?.querySelector<SVGPathElement>(".wavy-track") ?? undefined;
    this.#stopCircle = this.shadowRoot?.querySelector<SVGCircleElement>(".wavy-stop") ?? undefined;
  }

  /** @private Push the current geometry, fractions and amplitude policy into the driver. */
  #syncWaveDriver(): void {
    const driver = this.#waveDriver;
    const progressEl = this.shadowRoot?.querySelector<HTMLElement>(".progress");
    if (!driver || !progressEl) return;

    const width = progressEl.clientWidth;
    // Full drawing height: stroke + 2 * amplitude, matching the wavy host height.
    const height = this.#strokeWidth + this.#amplitude * 2;
    driver.setGeometry({
      width,
      height,
      stroke: this.#strokeWidth,
      trackStroke: this.#strokeWidth,
      wavelength: this.#wavelength || 40,
      gap: this.#strokeWidth,
      stopSize: this.#strokeWidth,
    });

    const { fractions, amplitude, animateAmplitude } = this.#computeWaveState();
    driver.setProgress(fractions, amplitude, animateAmplitude);

    // Indeterminate/query always needs the rAF loop (fractions advance over time); determinate only
    // while the amplitude is non-zero (otherwise a static flat line is enough).
    const animate = this.#isIndeterminate() || driver.needsAnimation;
    if (animate) driver.start();
    else {
      driver.stop();
      this.#paintWave(this.#lastWaveFrame ?? this.#emptyWaveFrame());
    }
  }

  /** @private */ #lastWaveFrame?: WaveFrame;

  /** @private */ #emptyWaveFrame(): WaveFrame {
    return { phase: 0, amplitude: 0, activePaths: [], trackPaths: [], stop: null };
  }

  /** @private */ #isIndeterminate(): boolean {
    return this.mode === "indeterminate" || this.mode === "query";
  }

  /**
   * @private Determine the wave fractions and target amplitude. Determinate uses `[0, progress]`
   * with an amplitude that switches on between 10% and 95%; indeterminate/query uses a live
   * fraction provider running the two chasing parts over a 1750ms cycle at full amplitude.
   */
  #computeWaveState(): { fractions: number[] | (() => number[]); amplitude: number; animateAmplitude: boolean } {
    if (this.#isIndeterminate()) {
      return { fractions: () => this.#indeterminateFractions(), amplitude: 1, animateAmplitude: false };
    }
    const progress = this.max > 0 ? Math.max(0, Math.min(1, this.value / this.max)) : 0;
    return { fractions: [0, progress], amplitude: defaultAmplitudeForProgress(progress), animateAmplitude: true };
  }

  /** @private */ #indeterminateStart = 0;

  /** @private Linear indeterminate fractions at the current loop time (see wavy.ts). */
  #indeterminateFractions(): number[] {
    if (this.#indeterminateStart === 0) this.#indeterminateStart = performance.now();
    return linearIndeterminateFractions(performance.now() - this.#indeterminateStart);
  }

  /** @private Paint a frame into the SVG path elements. */
  #paintWave(frame: WaveFrame): void {
    this.#lastWaveFrame = frame;
    const height = this.#strokeWidth + this.#amplitude * 2;
    const canvas = this.shadowRoot?.querySelector<SVGSVGElement>(".wavy-canvas");
    if (canvas) canvas.setAttribute("viewBox", `0 0 ${canvas.clientWidth || 1} ${height || 1}`);

    if (this.#activePath) {
      this.#activePath.setAttribute("d", frame.activePaths.join(" "));
      this.#activePath.setAttribute("stroke-width", `${this.#strokeWidth}`);
      this.#activePath.setAttribute("stroke-linecap", "round");
    }
    if (this.#trackPath) {
      this.#trackPath.setAttribute("d", frame.trackPaths.join(" "));
      this.#trackPath.setAttribute("stroke-width", `${this.#strokeWidth}`);
    }
    if (this.#stopCircle) {
      if (frame.stop) {
        this.#stopCircle.setAttribute("cx", `${frame.stop.x}`);
        this.#stopCircle.setAttribute("cy", `${frame.stop.y}`);
        this.#stopCircle.setAttribute("r", `${frame.stop.size / 2}`);
        this.#stopCircle.style.display = "";
      } else {
        this.#stopCircle.style.display = "none";
      }
    }
  }

  /** @private Start/refresh the driver when the wavy variant is active. */
  #startWave(): void {
    if (this.variant !== "wavy") return;
    this.#initWaveDriver();
    this.#syncWaveDriver();
  }

  /** @private */ #stopWave(): void {
    this.#waveDriver?.stop();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-linear-progress-indicator": M3eLinearProgressIndicatorElement;
  }
}
