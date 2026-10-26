import { LitElement, html, css, PropertyValues } from "lit";
import { property, query } from "lit/decorators.js";

import {
  AttachInternals,
  customElement,
  DesignToken,
  ReconnectedCallback,
  Role,
  setCustomEnumState,
} from "@wanjie/m3e-web/core";

import { isLoadingIndicatorVariant, LoadingIndicatorVariant } from "./LoadingIndicatorVariant";
import { LoadingIndicatorToken } from "./LoadingIndicatorToken";
import { ShapePathData, ShapePolygon } from "./ShapePolygon";
import { prepareMorphShapes, ShapeMorphSequence } from "@wanjie/m3e-web/geometry";

/** The order the indeterminate indicator morphs through (matches AndroidX LoadingIndicator). */
const MORPH_ORDER = ["soft-burst", "9-sided-cookie", "pentagon", "pill", "sunny", "4-sided-cookie", "oval"] as const;

/** Milliseconds between consecutive shape morphs (AndroidX `MorphIntervalMillis`). */
const MORPH_INTERVAL_MS = 650;

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
 * @attr pull-progress - Pull-to-refresh progress in turns; each increment of 1 rotates the indicator one full turn.
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
      transform: rotate(var(--_pull-rotation, 0deg));
      transition: transform ${DesignToken.motion.spring.fastEffects};
      will-change: transform;
    }
    .container.pull .active-indicator {
      clip-path: var(--_polygon-soft-burst);
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
   * Pull-to-refresh progress in turns; each increment of 1 rotates the indicator one full turn. Set to `null` when no
   * pull gesture is active.
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

    if (pulling) {
      this._container?.style.setProperty(
        "--_pull-rotation",
        `${-360 * (Number.isFinite(pullProgress) ? Math.max(0, pullProgress) : 0)}deg`,
      );
    }

    // The moving (indeterminate) state is driven by the JS shape-morph engine; the pull state keeps a
    // static shape.
    if (!pulling) {
      this.#startMorph();
    } else {
      this.#stopMorph();
    }
  }

  /** Starts the indeterminate shape-morph cycle (idempotent). @private */
  #startMorph(): void {
    if (this.#morph) {
      if (!this.#morph.isRunning) this.#morph.start();
      return;
    }
    const shapes = prepareMorphShapes(
      MORPH_ORDER.map((key) => ShapePathData[key]),
      160,
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
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-loading-indicator": M3eLoadingIndicatorElement;
  }
}
