import { css, CSSResultGroup, html, LitElement, svg } from "lit";
import { property, state } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

import { LevelIndicatorDefaults, indicatorSegments, levelIndicatorArcGeometry, levelIndicatorHeight } from "./levelIndicatorGeometry";

/**
 * A Wear OS Material 3 level indicator — a curved stroke on the right side of a circular screen
 * showing a value in `[0, 1]` (e.g. volume controlled by the side button / bezel). Ported from
 * AndroidX Wear `LevelIndicator.kt` + `ScrollIndicator.IndicatorImpl`.
 *
 * @tag m3e-wear-level-indicator
 *
 * @attr value - Fraction in [0, 1] (values outside are coerced).
 * @attr disabled - Whether disabled colors are used.
 * @attr sweep-angle - The angle covered by the indicator, in degrees (default 72).
 * @attr stroke-width - Stroke width for indicator and track (default 6).
 * @attr reverse-direction - Reverses the fill direction.
 * @attr side - Which side of the screen the arc hugs: `right` (default) or `left`.
 *
 * @cssprop --m3e-wear-level-indicator-color - Active arc color.
 * @cssprop --m3e-wear-level-indicator-track-color - Track arc color.
 * @cssprop --m3e-wear-level-indicator-disabled-color - Disabled active arc color.
 * @cssprop --m3e-wear-level-indicator-disabled-track-color - Disabled track arc color.
 * @cssprop --m3e-wear-level-indicator-diameter - The screen diameter the arc wraps (default 192).
 */
@customElement("m3e-wear-level-indicator")
export class M3eWearLevelIndicatorElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      width: var(--m3e-wear-level-indicator-diameter, 192px);
      aspect-ratio: 1;
      pointer-events: none;
    }
    :host([hidden]) {
      display: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .indicator {
      stroke: var(--m3e-wear-level-indicator-color, var(--m3e-color-secondary, #ccc2dc));
      transition: stroke 200ms;
    }
    .track {
      stroke: var(--m3e-wear-level-indicator-track-color, var(--m3e-color-surface-container-highest, #e6e0e9));
      transition: stroke 200ms;
    }
    :host([disabled]) .indicator {
      stroke: var(--m3e-wear-level-indicator-disabled-color, var(--m3e-color-on-surface, #1d1b20));
      opacity: 0.38;
    }
    :host([disabled]) .track {
      stroke: var(--m3e-wear-level-indicator-disabled-track-color, var(--m3e-color-on-surface, #1d1b20));
      opacity: 0.12;
    }
  `;

  /** The value of the indicator as a fraction in [0, 1]. @default 0 */
  @property({ type: Number, reflect: true }) value = 0;

  /** Whether disabled colors are used. @default false */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** The angle covered by the indicator, in degrees. @default 72 */
  @property({ type: Number, attribute: "sweep-angle" }) sweepAngle = LevelIndicatorDefaults.sweepAngle;

  /** The stroke width for the indicator and track strokes. @default 6 */
  @property({ type: Number, attribute: "stroke-width" }) strokeWidth = LevelIndicatorDefaults.strokeWidth;

  /** Reverses the fill direction. @default false */
  @property({ type: Boolean, attribute: "reverse-direction" }) reverseDirection = false;

  /** Which side of the screen the arc hugs. @default "right" */
  @property({ reflect: true, useDefault: true }) side: "right" | "left" = "right";

  /** @private Measured host diameter in px (the arc is drawn in real px, so strokes don't scale). */
  @state() private _diameter = 0;
  /** @private */ #ro?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(() => {
        const d = Math.min(this.clientWidth, this.clientHeight || this.clientWidth);
        if (d > 0 && d !== this._diameter) this._diameter = d;
      });
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  protected override render(): unknown {
    const diameter = this._diameter || 192;
    const c = diameter / 2;
    const height = levelIndicatorHeight(diameter, this.strokeWidth, this.sweepAngle);
    const g = levelIndicatorArcGeometry(diameter, this.strokeWidth, height);
    const value = Math.min(1, Math.max(0, this.value));
    const size = value;
    const position = 1; // LevelIndicator always starts at the bottom (`FractionPositionStateAdapter`)
    const indicatorStart = position * (1 - size);
    const segs = indicatorSegments(g.sweepDegrees, indicatorStart, size);
    // Mirror the arc across the vertical axis for the left side.
    const flip = this.side === "left" ? `scale(-1,1) translate(${-diameter},0)` : "";
    const arcR = g.arcRadius;

    // drawCurvedIndicatorSegment: when a segment's sweep <= gap, draw a fading dot instead.
    const segment = (
      cls: string,
      seg: { start: number; sweep: number },
      key: string,
    ): unknown => {
      if (seg.sweep <= g.gapPaddingDegrees) {
        const fraction = g.gapPaddingDegrees > 0 ? seg.sweep / g.gapPaddingDegrees : 0;
        if (fraction <= 0) return svg``;
        const angle = ((seg.start + seg.sweep / 2) * Math.PI) / 180;
        const r = (this.strokeWidth / 2) * fraction;
        const cx = c + arcR * Math.cos(angle);
        const cy = c + arcR * Math.sin(angle);
        return svg`<circle key=${key} cx=${cx} cy=${cy} r=${r} class=${cls}
          opacity=${fraction} fill="currentColor" stroke="none"
          style="color:inherit"></circle>`;
      }
      const a0 = seg.start + g.gapPaddingDegrees / 2;
      const sweep = Math.max(seg.sweep - g.gapPaddingDegrees, 0);
      const large = sweep > 180 ? 1 : 0;
      const x0 = c + arcR * Math.cos((a0 * Math.PI) / 180);
      const y0 = c + arcR * Math.sin((a0 * Math.PI) / 180);
      const x1 = c + arcR * Math.cos(((a0 + sweep) * Math.PI) / 180);
      const y1 = c + arcR * Math.sin(((a0 + sweep) * Math.PI) / 180);
      return svg`<path key=${key} class=${cls} d="M ${x0} ${y0} A ${arcR} ${arcR} 0 ${large} 1 ${x1} ${y1}"
        fill="none" stroke-width=${this.strokeWidth} stroke-linecap="round" pathLength="1"></path>`;
    };

    // AndroidX draws at 3 o'clock with angles measured from the top (startTopArc = -sweep/2 is
    // measured in canvas coordinates: 0° = 3 o'clock, positive sweep goes clockwise downward).
    // The level indicator grows from the bottom (position=1): value fills upward from the
    // bottom end of the arc toward the top end.
    return html`<svg viewBox="0 0 ${diameter} ${diameter}" role="img" aria-label="Level indicator">
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
    "m3e-wear-level-indicator": M3eWearLevelIndicatorElement;
  }
}
