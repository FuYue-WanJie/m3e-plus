import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

/** The screen outline. Wear device screens are round; `round-square` is the squircle variant. */
export type WearScreenShape = "circle" | "round-square";

/**
 * A Wear OS screen container — the circular (or round-square) viewport that Wear components are
 * laid out inside, inspired by AndroidX Wear `ScreenScaffold`. It clips its content to the screen
 * shape, provides a default content slot, and an optional `edgeButton` slot pinned to the bottom
 * edge (where an `<m3e-edge-button>` belongs).
 *
 * @tag m3e-wear-screen
 *
 * @attr diameter - Diameter of the (circular) screen, in px. Default 192.
 * @attr shape - `circle` (default) or `round-square`.
 *
 * @slot - The screen content.
 * @slot edgeButton - An action pinned to the bottom of the screen (e.g. `<m3e-edge-button>`).
 *
 * @cssprop --m3e-wear-screen-background - Screen background colour (default surface).
 * @cssprop --m3e-wear-screen-border - Screen bezel border (default 3px solid grey).
 * @cssprop --m3e-wear-screen-diameter - Diameter override.
 */
@customElement("m3e-wear-screen")
export class M3eWearScreenElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: inline-block;
      position: relative;
      vertical-align: middle;
      box-sizing: border-box;
      width: var(--m3e-wear-screen-diameter, 192px);
      height: var(--m3e-wear-screen-diameter, 192px);
      background: var(--m3e-wear-screen-background, var(--m3e-color-surface, #141218));
      color: var(--m3e-color-on-surface, #e6e0e9);
      /* Bezel drawn outside the screen so it never eats into the diameter. */
      box-shadow: 0 0 0 var(--m3e-wear-screen-bezel-width, 3px) var(--m3e-wear-screen-bezel-color, #79747e);
      overflow: hidden;
      isolation: isolate;
      container-type: inline-size;
      -webkit-tap-highlight-color: transparent;
    }
    /* Circular screen by default. */
    :host,
    :host(:is([shape="circle"], :not([shape]))) {
      border-radius: 50%;
    }
    :host([shape="round-square"]) {
      /* Round-square watches vary by device; tune per device via the token. */
      border-radius: var(--m3e-wear-screen-round-square-radius, 28%);
    }
    :host([hidden]) {
      display: none;
    }
    .screen {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      /* Padding scales with the screen like AndroidX (5.2% of screen width). cqw keeps the padding
         and the edge button's negative margin on the same basis. */
      --_hpad: var(--m3e-wear-screen-horizontal-padding, 5.2cqw);
      --_vpad: var(--m3e-wear-screen-vertical-padding, 5.2cqw);
      padding: var(--_vpad) var(--_hpad);
      overflow: hidden;
    }
    .content {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .edge-button {
      flex: none;
      display: flex;
      justify-content: center;
      /* The edge button spans the full screen width and hugs the bottom edge: cancel the screen
         padding (its own 3dp gap is part of the shape). */
      margin: 0 calc(-1 * var(--_hpad)) calc(-1 * var(--_vpad));
    }
    /* Scaffold mode (set by a bound m3e-edge-button): an edge button tied to a scrolling list overlays the bottom of the
       list instead of taking its own row, and the list runs to the screen edge (ScreenScaffold). */
    :host([scaffold]) .screen {
      padding-bottom: 0;
    }
    :host([scaffold]) .edge-button {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      margin: 0;
      align-items: flex-end;
      pointer-events: none;
    }
    :host([scaffold]) .edge-button ::slotted(*) {
      pointer-events: auto;
    }
    .edge-button[hidden] {
      display: none;
    }
    ::slotted(*) {
      box-sizing: border-box;
    }
  `;

  /** The screen diameter in px. @default 192 */
  @property({ type: Number }) diameter = 192;

  /** The screen outline. @default "circle" */
  @property({ reflect: true, useDefault: true }) shape: WearScreenShape = "circle";

  /** @private */ #hasEdgeButton = false;
  /** @private */ readonly #onSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const has = slot.assignedElements({ flatten: true }).length > 0;
    if (has !== this.#hasEdgeButton) {
      this.#hasEdgeButton = has;
      const wrap = this.shadowRoot?.querySelector<HTMLElement>(".edge-button");
      wrap?.toggleAttribute("hidden", !has);
      this.requestUpdate();
    }
  };

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();
    this.style.setProperty("--m3e-wear-screen-diameter", `${this.diameter}px`);
  }

  /** @inheritdoc */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("diameter")) {
      this.style.setProperty("--m3e-wear-screen-diameter", `${this.diameter}px`);
    }
    if (changed.has("shape") && this.shape !== "circle" && this.shape !== "round-square") {
      this.shape = "circle";
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return html`
      <div class="screen">
        <div class="content" part="content"><slot></slot></div>
        <div class="edge-button" part="edge-button" ?hidden=${!this.#hasEdgeButton}>
          <slot name="edgeButton" @slotchange=${this.#onSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-wear-screen": M3eWearScreenElement;
  }
}
