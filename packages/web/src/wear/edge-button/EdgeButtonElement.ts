import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

import { EdgeButtonDefaults, edgeButtonGeometry, edgeButtonPathData } from "./edgeButtonPath";

/** Edge button sizes (`EdgeButtonSize.maximumHeight`). */
export type EdgeButtonSize = "extra-small" | "small" | "medium" | "large";

const SIZE_HEIGHT: Record<EdgeButtonSize, number> = {
  "extra-small": 46,
  small: 56,
  medium: 70,
  large: 96,
};

const ICON_SIZE: Record<EdgeButtonSize, number> = {
  "extra-small": 24,
  small: 32,
  medium: 32,
  large: 36,
};

/**
 * A Wear OS Material 3 edge button — a bottom-of-screen action whose container is a custom shape
 * (rounded arc on top, ellipse meeting the screen edge at the bottom). Ported from AndroidX Wear
 * `EdgeButton.kt` (`EdgeButtonShape`).
 *
 * @tag m3e-edge-button
 *
 * @attr size - `extra-small` | `small` (default) | `medium` | `large`.
 * @attr color - Container color (default `--m3e-color-primary-container`).
 *
 * @slot - The button content (typically an icon).
 *
 * @cssprop --m3e-edge-button-color - Container color.
 * @cssprop --m3e-edge-button-content-color - Content (icon/label) color.
 */
@customElement("m3e-edge-button")
export class M3eEdgeButtonElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      /* Fill the parent width (AndroidX fillMaxWidth): the shape derives its arc from the
         screen width, so the host must span the edgeButton slot of m3e-wear-screen. */
      display: block;
      width: 100%;
      position: relative;
      vertical-align: bottom;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      color: var(--m3e-edge-button-content-color, #fff);
    }
    :host([hidden]) {
      display: none;
    }
    .container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .shape {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .shape .fill {
      fill: var(--m3e-edge-button-color, var(--m3e-color-primary-container, #4f378b));
    }
    .content {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    ::slotted(*) {
      display: block;
    }
  `;

  /** The size of the edge button. @default "small" */
  @property({ reflect: true, useDefault: true }) size: EdgeButtonSize = "small";

  /** @private */ @state() private _path = "";
  /** @private */ @state() private _iconSize = 32;
  /** @private */ @state() private _contentStyle = "";

  /** @inheritdoc */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("size")) this.#recompute();
  }

  /** @inheritdoc */
  protected override firstUpdated(): void {
    this.#recompute();
    if (typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(() => this.#recompute());
      this.#ro.observe(this);
    }
  }

  /** @private */ #ro?: ResizeObserver;

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  /** @private */ #recompute(): void {
    const size = SIZE_HEIGHT[this.size] ?? SIZE_HEIGHT.small;
    const width = this.clientWidth || size * 2;
    const height = this.clientHeight || size;
    this._path = edgeButtonPathData(width, height);
    this._iconSize = ICON_SIZE[this.size] ?? 32;
    const g = edgeButtonGeometry(width, height);
    // Content sits in the usable window (inset from the arc edges), a touch above the bottom edge.
    const left = Math.max(0, g.contentLeft);
    const right = Math.max(0, width - g.contentRight);
    this._contentStyle = `left:${left}px;right:${right}px;top:0;bottom:${EdgeButtonDefaults.verticalPadding}px;`;
  }

  /** @inheritdoc */
  protected override render(): unknown {
    const height = SIZE_HEIGHT[this.size] ?? SIZE_HEIGHT.small;
    return html`
      <div class="container" style="height:${height}px">
        <svg class="shape" viewBox="0 0 ${this.clientWidth || height * 2} ${height}" preserveAspectRatio="none">
          <path class="fill" d=${this._path}></path>
        </svg>
        <div class="content" style=${this._contentStyle}>
          <slot style="font-size:${this._iconSize}px"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-edge-button": M3eEdgeButtonElement;
  }
}
