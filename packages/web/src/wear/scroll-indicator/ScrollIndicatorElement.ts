import { css, CSSResultGroup, html, LitElement, PropertyValues, svg } from "lit";
import { property, state } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

import { ScrollBinding } from "../scrollBinding";
import { LevelIndicatorDefaults, indicatorSegments, levelIndicatorArcGeometry } from "../level-indicator/levelIndicatorGeometry";

/**
 * A Wear OS Material 3 scroll indicator — a curved scrollbar on one side of a circular screen,
 * showing a scroll position (`positionFraction`) and viewport proportion (`sizeFraction`).
 * Ported from AndroidX Wear `ScrollIndicator.kt` (`IndicatorImpl`).
 *
 * The indicator animates position/size changes with a 500ms cubic-bezier(0,0,0,1) tween,
 * matching `ScrollIndicatorDefaults.PositionAnimationSpec`.
 *
 * @tag m3e-wear-scroll-indicator
 *
 * @attr position - Scroll position fraction in [0, 1] (0 = top, 1 = bottom).
 * @attr size - Viewport size fraction in [0, 1]; clamped to [0.3, 0.7] like the adapters.
 * @attr reverse-direction - Reverses the direction of the position.
 * @attr side - Which side of the screen the arc hugs: `right` (default) or `left`.
 * @attr no-animation - Snap position/size changes instead of tweening.
 * @attr for - Id of a scroll container to track; position and size then follow its scroll
 *   automatically (like AndroidX's ScrollState / LazyListState adapters). Set `scrollTarget`
 *   to bind an element reference instead. When the content does not overflow, the indicator hides.
 *
 * @cssprop --m3e-wear-scroll-indicator-color - Active arc color.
 * @cssprop --m3e-wear-scroll-indicator-track-color - Track arc color.
 * @cssprop --m3e-wear-scroll-indicator-height - Indicator arc height (default 50px of diameter).
 */
/** CSS-style cubic-bezier easing solved for x (Newton + bisection fallback). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const by = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const v = bx(t) - x;
      if (Math.abs(v) < 1e-6) break;
      if (v > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return by(t);
  };
}

@customElement("m3e-wear-scroll-indicator")
export class M3eWearScrollIndicatorElement extends LitElement {
  static override styles: CSSResultGroup = css`
    /* Screen overlay (AndroidX draws indicators over the whole screen): fills the nearest
       positioned ancestor, e.g. m3e-wear-screen, regardless of the screen's content padding. */
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      transition: opacity 200ms;
    }
    :host([inactive]) {
      opacity: 0;
    }
    :host([hidden]) {
      display: none;
    }
    /* Arcs are strokes only; the class fill below is for the fading end dots. */
    svg path.indicator,
    svg path.track {
      fill: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .indicator {
      /* Wear is dark-only: OnBackground at luminance 80 / 20 (ScrollIndicatorDefaults). */
      stroke: var(--m3e-wear-scroll-indicator-color, #c9c5ca);
      fill: var(--m3e-wear-scroll-indicator-color, #c9c5ca);
    }
    .track {
      stroke: var(--m3e-wear-scroll-indicator-track-color, #313033);
      fill: var(--m3e-wear-scroll-indicator-track-color, #313033);
    }
  `;

  /** Scroll position fraction in [0, 1]. @default 0 */
  @property({ type: Number, reflect: true }) position = 0;

  /** Viewport size fraction in [0, 1] (clamped to [0.3, 0.7]). @default 0.5 */
  @property({ type: Number }) size = 0.5;

  /** Reverses the direction of the position. @default false */
  @property({ type: Boolean, attribute: "reverse-direction" }) reverseDirection = false;

  /** Which side of the screen the arc hugs. @default "right" */
  @property({ reflect: true, useDefault: true }) side: "right" | "left" = "right";

  /** Snap instead of tweening position/size changes. @default false */
  @property({ type: Boolean, attribute: "no-animation" }) noAnimation = false;

  /** Id of the scroll container to track (resolved in this element's root). */
  @property({ attribute: "for" }) for: string | null = null;

  /** A scroll container element to track; takes precedence over `for`. */
  @property({ attribute: false }) scrollTarget: HTMLElement | null = null;

  /** @private */ #binding = new ScrollBinding(this, (m) => {
    // Continuous scroll follows the finger directly; the 500ms tween is for programmatic jumps.
    this.#snapNext = true;
    this.toggleAttribute("inactive", m.range <= 0);
    this.position = m.range > 0 ? m.offset / m.range : 0;
    this.size = m.viewportFraction;
  });
  /** @private */ #snapNext = false;

  /** @private */ @state() private _animPosition = 0;
  /** @private */ @state() private _animSize = 0.5;
  /** @private */ #raf = 0;
  /** @private */ #animStart = 0;
  /** @private */ #fromPosition = 0;
  /** @private */ #fromSize = 0.5;

  /** The indicator height in px (ScrollIndicatorDefaults.indicatorHeight = 50dp). @default 50 */
  @property({ type: Number, attribute: "arc-height" }) arcHeight = LevelIndicatorDefaults.scrollIndicatorHeight;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("position") || changed.has("size")) {
      const targetSize = Math.min(0.7, Math.max(0.3, this.size));
      // First paint, no-animation and scroll-driven updates snap; later changes tween.
      const snap = this.#snapNext;
      this.#snapNext = false;
      if (this.noAnimation || !this.hasUpdated || snap) {
        cancelAnimationFrame(this.#raf);
        this.#raf = 0;
        this._animPosition = this.position;
        this._animSize = targetSize;
        return;
      }
      this.#fromPosition = this._animPosition;
      this.#fromSize = this._animSize;
      this.#startAnimation(this.position, targetSize);
    }
  }

  /** @inheritdoc */
  /** @private Measured host diameter in px (the arc is drawn in real px, so strokes don't scale). */
  @state() private _diameter = 0;
  /** @private */ #ro?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#binding.bind(this.scrollTarget ?? this.for);
    if (typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(() => {
        const d = Math.min(this.clientWidth, this.clientHeight || this.clientWidth);
        if (d > 0 && d !== this._diameter) this._diameter = d;
      });
      this.#ro.observe(this);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has("for") || changed.has("scrollTarget")) this.#binding.bind(this.scrollTarget ?? this.for);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#binding.unbind();
    this.#ro?.disconnect();
    this.#ro = undefined;
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** 500ms tween, cubic-bezier(0, 0, 0, 1) — `ScrollIndicatorDefaults.PositionAnimationSpec`. */
  #startAnimation(targetPosition: number, targetSize: number): void {
    cancelAnimationFrame(this.#raf);
    this.#animStart = performance.now();
    const fromPosition = this.#fromPosition;
    const fromSize = this.#fromSize;
    const ease = cubicBezier(0, 0, 0, 1); // ScrollIndicatorDefaults.PositionAnimationSpec
    const step = (now: number): void => {
      const t = Math.min(1, (now - this.#animStart) / 500);
      const k = ease(t);
      this._animPosition = fromPosition + (targetPosition - fromPosition) * k;
      this._animSize = fromSize + (targetSize - fromSize) * k;
      if (t < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = 0;
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  protected override render(): unknown {
    const diameter = this._diameter || 192;
    const c = diameter / 2;
    const strokeWidth = LevelIndicatorDefaults.scrollIndicatorWidth;
    const g = levelIndicatorArcGeometry(diameter, strokeWidth, this.arcHeight);
    const size = Math.min(1, Math.max(0, this._animSize));
    const position = Math.min(1, Math.max(0, this.reverseDirection ? 1 - this._animPosition : this._animPosition));
    const indicatorStart = position * (1 - size);
    const segs = indicatorSegments(g.sweepDegrees, indicatorStart, size);
    const flip = this.side === "left" ? `scale(-1,1) translate(${-diameter},0)` : "";
    const arcR = g.arcRadius;

    const segment = (cls: string, seg: { start: number; sweep: number }, key: string): unknown => {
      if (seg.sweep <= 0) return svg``;
      if (seg.sweep <= g.gapPaddingDegrees) {
        const fraction = seg.sweep / g.gapPaddingDegrees;
        const angle = ((seg.start + seg.sweep / 2) * Math.PI) / 180;
        const r = (strokeWidth / 2) * fraction;
        const cx = c + arcR * Math.cos(angle);
        const cy = c + arcR * Math.sin(angle);
        return svg`<circle key=${key} cx=${cx} cy=${cy} r=${r} class=${cls} opacity=${fraction}
          stroke="none"></circle>`;
      }
      const a0 = seg.start + g.gapPaddingDegrees / 2;
      const sweep = Math.max(seg.sweep - g.gapPaddingDegrees, 0);
      const large = sweep > 180 ? 1 : 0;
      const x0 = c + arcR * Math.cos((a0 * Math.PI) / 180);
      const y0 = c + arcR * Math.sin((a0 * Math.PI) / 180);
      const x1 = c + arcR * Math.cos(((a0 + sweep) * Math.PI) / 180);
      const y1 = c + arcR * Math.sin(((a0 + sweep) * Math.PI) / 180);
      return svg`<path key=${key} class=${cls} d="M ${x0} ${y0} A ${arcR} ${arcR} 0 ${large} 1 ${x1} ${y1}"
        fill="none" stroke-width=${strokeWidth} stroke-linecap="round"></path>`;
    };

    return html`<svg viewBox="0 0 ${diameter} ${diameter}" role="img" aria-label="Scroll indicator">
      <g transform="${flip}">
        ${segment("track", segs.top, "t")}${segment("indicator", segs.mid, "m")}${segment(
          "track",
          segs.bottom,
          "b",
        )}
      </g>
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-wear-scroll-indicator": M3eWearScrollIndicatorElement;
  }
}
