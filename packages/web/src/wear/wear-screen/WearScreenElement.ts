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
      /* Subtle outline delineating the bezel; override or remove via the token. */
      border: var(--m3e-wear-screen-border, 3px solid #79747e);
      overflow: hidden;
      isolation: isolate;
      -webkit-tap-highlight-color: transparent;
    }
    /* Circular screen by default. */
    :host,
    :host(:is([shape="circle"], :not([shape]))) {
      border-radius: 50%;
    }
    :host([shape="round-square"]) {
      border-radius: 28%;
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
      /* Wear content sits inside the round screen with horizontal breathing room. */
      padding: 12px;
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
      /* The edge button hugs the bottom of the screen. */
      margin: 0 -12px -12px;
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
