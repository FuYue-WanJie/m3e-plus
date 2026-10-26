import { LitElement, html, css, PropertyValues } from "lit";
import { property, query } from "lit/decorators.js";

import {
  AttachInternals,
  customElement,
  ReconnectedCallback,
  Role,
  setCustomEnumState,
} from "@wanjie/m3e-web/core";

import { isLoadingIndicatorVariant, LoadingIndicatorVariant } from "./LoadingIndicatorVariant";
import { LoadingIndicatorToken } from "./LoadingIndicatorToken";
import { ShapePathData, ShapePolygon } from "./ShapePolygon";
import {
  alignPolygon,
  circlePolygon,
  MorphPolygon,
  morphPolygon,
  normalizePolygon,
  polygonToClipPath,
  prepareMorphShapes,
  sampleSvgPath,
  ShapeMorphSequence,
} from "@wanjie/m3e-web/geometry";

/** The order the indeterminate indicator morphs through (matches AndroidX LoadingIndicator). */
const MORPH_ORDER = ["soft-burst", "9-sided-cookie", "pentagon", "pill", "sunny", "4-sided-cookie", "oval"] as const;

/** Milliseconds between consecutive shape morphs (AndroidX `MorphIntervalMillis`). */
const MORPH_INTERVAL_MS = 650;

/** Points each shape is resampled to for morphing. */
const MORPH_SAMPLES = 160;

/**
 * The determinate (pull) morph: a circle into the soft burst, as AndroidX
 * `LoadingIndicatorDefaults.DeterminateIndicatorPolygons`. Built lazily and shared.
 */
let determinateShapes: [MorphPolygon, MorphPolygon] | undefined;
function getDeterminateShapes(): [MorphPolygon, MorphPolygon] {
  if (!determinateShapes) {
    const burst = normalizePolygon(sampleSvgPath(ShapePathData["soft-burst"], MORPH_SAMPLES));
    // AndroidX rotates the circle by 360/20 degrees so its vertices line up with the burst.
    const circle = alignPolygon(burst, circlePolygon(MORPH_SAMPLES, 360 / 20));
    determinateShapes = [circle, burst];
  }
  return determinateShapes;
}

/** Degrees the indicator turns on each morph step (AndroidX `QuarterRotation`). */
const MORPH_STEP_DEGREES = 90;

/**
 * Shows indeterminate progress for a short wait time.
 *
 * @description
 * The `m3e-loading-indicator` component uses animation to grab attention, mitigate perceived latency, and indicate
 * that an activity is in progress.
 *
 * When placed over other content, use the `variant` attribute to change the appearance from `uncontained` (the default),
 * to `contained` so that it has strong contrast to help it stand out better.
 *
 * @example
 * The following example illustrates an uncontained loading indicator.
 * ```html
 * <m3e-loading-indicator></m3e-loading-indicator>
 * ```
 *
 * @tag m3e-loading-indicator
 *
 * @attr variant - The appearance variant of the indicator.
 * @attr pull-progress - Determinate (pull-to-refresh) progress from 0 to 1: morphs a circle into the soft burst while
 * turning 180° counterclockwise, as AndroidX's determinate `LoadingIndicator`. Values are clamped to 0..1.
 *
 * @cssprop --m3e-loading-indicator-active-indicator-color - Uncontained active indicator color.
 * @cssprop --m3e-loading-indicator-contained-active-indicator-color - Contained active indicator color.
 * @cssprop --m3e-loading-indicator-contained-container-color - Contained container (background) color.
 * @cssprop --m3e-loading-indicator-active-indicator-size - Size of the active indicator.
 * @cssprop --m3e-loading-indicator-container-shape - Container shape.
 * @cssprop --m3e-loading-indicator-container-size - Container size.
 */
@customElement("m3e-loading-indicator")
export class M3eLoadingIndicatorElement extends ReconnectedCallback(Role(AttachInternals(LitElement), "progressbar")) {
  /** The styles of the element. */
  static override styles = css`
    :host {
      display: inline-block;
      aspect-ratio: 1 / 1;
      contain: layout paint style;
      vertical-align: middle;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:is(:state(--uncontained), :--uncontained)) {
      width: ${LoadingIndicatorToken.activeIndicatorSize};
    }
    :host(:is(:state(--contained), :--contained)) {
      width: ${LoadingIndicatorToken.containerSize};
    }
    :host(:is(:state(--uncontained), :--uncontained)) .active-indicator {
      background-color: ${LoadingIndicatorToken.activeIndicatorColor};
    }
    :host(:is(:state(--contained), :--contained)) .active-indicator {
      background-color: ${LoadingIndicatorToken.containedActiveIndicatorColor};
    }
    :host(:is(:state(--contained), :--contained)) .container {
      background-color: ${LoadingIndicatorToken.containedContainerColor};
    }
    .container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: ${LoadingIndicatorToken.containerShape};
    }
    .active-indicator {
      margin: auto;
      aspect-ratio: 1 / 1;
      width: calc(${LoadingIndicatorToken.activeIndicatorSize} * 0.842);
      transform-origin: center;
      will-change: transform, clip-path;
      /* The resting shape, shown before the first morph frame, while pulling and under reduced motion. */
      clip-path: var(--_polygon-soft-burst);

      --_polygon-soft-burst: polygon(${ShapePolygon["soft-burst"]});
      --_polygon-9-sided-cookie: polygon(${ShapePolygon["9-sided-cookie"]});
      --_polygon-pentagon: polygon(${ShapePolygon["pentagon"]});
      --_polygon-pill: polygon(${ShapePolygon["pill"]});
      --_polygon-sunny: polygon(${ShapePolygon["sunny"]});
      --_polygon-4-sided-cookie: polygon(${ShapePolygon["4-sided-cookie"]});
      --_polygon-oval: polygon(${ShapePolygon["oval"]});
    }
    .active-indicator-wrapper {
      transform-origin: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container.pull .active-indicator-wrapper {
      /* Tracks the gesture directly, like AndroidX (no easing between progress values). */
      transform: rotate(var(--_pull-rotation, 0deg));
      will-change: transform;
    }
    @media (forced-colors: active) {
      .active-indicator {
        background-color: CanvasText !important;
      }
    }
  `;

  /** @private */
  @query(".container") private readonly _container?: HTMLElement;

  /** The morphing inner shape. @private */
  @query(".active-indicator") private readonly _indicator?: HTMLElement;

  /**
   * Per-frame morph sequence that replaces the old CSS `rotate-inner` keyframes: it interpolates the
   * actual shape polygons (a true shape morph) and drives the inner rotation.
   * @private
   */
  #morph?: ShapeMorphSequence;

  /**
   * The appearance variant of the indicator.
   * @default "uncontained"
   */
  @property({ reflect: true, useDefault: true }) variant: LoadingIndicatorVariant = "uncontained";

  /**
   * Determinate (pull-to-refresh) progress from 0 to 1 (clamped). Morphs a circle into the soft burst while turning
   * 180° counterclockwise, matching AndroidX's determinate `LoadingIndicator`. Set to `null` when no pull gesture is
   * active, which returns to the indeterminate animation.
   * @default null
   */
  @property({ attribute: "pull-progress", type: Number, reflect: true }) pullProgress: number | null = null;

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();

    this.#applyVariant();
    this.ariaValueMin = this.ariaValueMin || "0";
    this.ariaValueMax = this.ariaValueMax || "100";
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopMorph();
    this._container?.classList.toggle("animate", false);
    this._container?.classList.toggle("pull", false);
  }

  /** @inheritdoc */
  override reconnectedCallback(): void {
    super.reconnectedCallback();
    this.#applyPullProgress();
  }

  /** @inheritdoc */
  protected override willUpdate(_changedProperties: PropertyValues<this>): void {
    super.willUpdate(_changedProperties);

    if (_changedProperties.has("variant")) {
      this.#applyVariant();
    }
    if (_changedProperties.has("pullProgress")) {
      this.#applyPullProgress();
    }
  }

  /** @inheritdoc */
  protected override firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.#applyPullProgress();
  }

  /** @inheritdoc */
  override render() {
    return html`<div class="container" aria-hidden="true">
      <div class="active-indicator-wrapper">
        <div class="active-indicator"></div>
      </div>
    </div>`;
  }

  /** @private */
  #applyVariant(): void {
    if (!isLoadingIndicatorVariant(this.variant)) {
      this.variant = "uncontained";
    }
    setCustomEnumState(this, this.variant, "contained", "uncontained");
  }

  /** @private */
  #applyPullProgress(): void {
    const pullProgress = this.pullProgress;
    const pulling = pullProgress !== null && !Number.isNaN(pullProgress);

    this._container?.classList.toggle("pull", pulling);
    this._container?.classList.toggle("animate", !pulling);

    // The moving (indeterminate) state is driven by the JS shape-morph engine; the pull state is a
    // determinate morph driven by the progress value.
    if (pulling) {
      this.#stopMorph();
      const progress = Number.isFinite(pullProgress) ? Math.min(1, Math.max(0, pullProgress)) : 0;
      // AndroidX: rotation = -progress * 180 (counterclockwise).
      this._container?.style.setProperty("--_pull-rotation", `${-180 * progress}deg`);
      const [circle, burst] = getDeterminateShapes();
      this._indicator?.style.setProperty("clip-path", polygonToClipPath(morphPolygon(circle, burst, progress)));
    } else {
      this.#startMorph();
    }
  }

  /** Starts the indeterminate shape-morph cycle (idempotent). @private */
  #startMorph(): void {
    // Honour reduced motion: keep the static resting shape instead of morphing and spinning.
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.#stopMorph();
      return;
    }
    if (this.#morph) {
      if (!this.#morph.isRunning) this.#morph.start();
      return;
    }
    const shapes = prepareMorphShapes(
      MORPH_ORDER.map((key) => ShapePathData[key]),
      MORPH_SAMPLES,
    );
    this.#morph = new ShapeMorphSequence({
      shapes,
      durationMs: MORPH_INTERVAL_MS,
      stepRotation: MORPH_STEP_DEGREES,
      globalRotationMs: 4666,
      loop: true,
      onFrame: (clipPath, rotation) => {
        const el = this._indicator;
        if (!el) return;
        el.style.clipPath = clipPath;
        el.style.transform = `rotate(${rotation}deg)`;
      },
    });
    this.#morph.start();
  }

  /** Stops the morph cycle. @private */
  #stopMorph(): void {
    this.#morph?.stop();
    // Drop the last frame's inline shape / rotation so the stylesheet's resting shape (and, while
    // pulling, the wrapper's pull rotation alone) applies again.
    this._indicator?.style.removeProperty("clip-path");
    this._indicator?.style.removeProperty("transform");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-loading-indicator": M3eLoadingIndicatorElement;
  }
}
