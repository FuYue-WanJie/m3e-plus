import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

import { edgeButtonGeometry, edgeButtonPathData } from "./edgeButtonPath";

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
      outline: none;
      color: var(--m3e-edge-button-content-color, var(--m3e-color-on-primary, #381e72));
    }
    :host([disabled]) {
      cursor: default;
      pointer-events: none;
      color: var(--m3e-edge-button-disabled-content-color, color-mix(in srgb, var(--m3e-color-on-surface, #e6e0e9) 38%, transparent));
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
      fill: var(--m3e-edge-button-color, var(--m3e-color-primary, #d0bcff));
    }
    :host([disabled]) .shape .fill {
      fill: var(--m3e-edge-button-disabled-color, color-mix(in srgb, var(--m3e-color-on-surface, #e6e0e9) 12%, transparent));
    }
    /* State layer (hover / focus / pressed), clipped to the same path. */
    .shape .state {
      fill: currentColor;
      opacity: 0;
      transition: opacity 150ms;
    }
    :host(:hover) .shape .state {
      opacity: 0.08;
    }
    :host(:focus-visible) .shape .state,
    :host([pressed]) .shape .state {
      opacity: 0.1;
    }
    :host(:focus-visible) .shape .focus {
      stroke: var(--m3e-edge-button-focus-ring-color, var(--m3e-color-secondary, #ccc2dc));
      stroke-width: 3;
    }
    .shape .focus {
      fill: none;
      stroke: transparent;
    }
    .content {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      /* AndroidX verticalContentPadding: 6dp top / 8dp bottom (asymmetric — the shape is
         asymmetric, so the content sits slightly above center). */
      padding: 6px 0 8px;
      /* Content wider than the usable window scales down (AndroidX scaleAndAlignContent). */
      overflow: hidden;
    }
    ::slotted(*) {
      display: block;
      max-width: 100%;
      max-height: 100%;
    }
  `;

  /** The size of the edge button. @default "small" */
  @property({ reflect: true, useDefault: true }) size: EdgeButtonSize = "small";

  /** Whether the button is disabled. @default false */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** @private */ @state() private _width = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    this.#syncDisabled();
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.addEventListener("click", this.#onClick, { capture: true });
  }

  #syncDisabled(): void {
    this.setAttribute("aria-disabled", String(this.disabled));
    if (this.disabled) this.removeAttribute("tabindex");
    else if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
  }

  #onClick = (e: Event): void => {
    if (this.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  #onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled || e.repeat) return;
    if (e.key === "Enter") {
      e.preventDefault();
      this.click();
    } else if (e.key === " ") {
      e.preventDefault();
      this.toggleAttribute("pressed", true);
    }
  };

  #onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== " " || !this.hasAttribute("pressed")) return;
    this.removeAttribute("pressed");
    if (!this.disabled) this.click();
  };

  #onPointerDown = (): void => {
    if (this.disabled) return;
    this.toggleAttribute("pressed", true);
    const up = (): void => {
      this.removeAttribute("pressed");
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** @private */ @state() private _path = "";
  /** @private */ @state() private _iconSize = 32;
  /** @private */ @state() private _contentStyle = "";

  /** @inheritdoc */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("size")) this.#recompute();
    if (changed.has("disabled") && this.isConnected) this.#syncDisabled();
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
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("keyup", this.#onKeyUp);
    this.removeEventListener("pointerdown", this.#onPointerDown);
    this.removeEventListener("click", this.#onClick, { capture: true });
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  /** @private */ #recompute(): void {
    const size = SIZE_HEIGHT[this.size] ?? SIZE_HEIGHT.small;
    const width = this.clientWidth || size * 2;
    const height = size; // must match the rendered container/viewBox height
    this._width = width;
    this._path = edgeButtonPathData(width, height);
    this._iconSize = ICON_SIZE[this.size] ?? 32;
    const g = edgeButtonGeometry(width, height);
    // Content sits in the usable window (inset from the arc edges). Vertical padding is applied
    // by .content itself; here we only position the window.
    const left = Math.max(0, g.contentLeft);
    const right = Math.max(0, width - g.contentRight);
    const top = Math.max(0, g.contentTop);
    const bottom = Math.max(0, height - g.contentBottom);
    this._contentStyle = `left:${left}px;right:${right}px;top:${top}px;bottom:${bottom}px;`;
  }

  /** @inheritdoc */
  protected override render(): unknown {
    const height = SIZE_HEIGHT[this.size] ?? SIZE_HEIGHT.small;
    return html`
      <div class="container" style="height:${height}px">
        <svg class="shape" viewBox="0 0 ${this._width || height * 2} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <path class="fill" d=${this._path}></path>
          <path class="state" d=${this._path}></path>
          <path class="focus" d=${this._path}></path>
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
