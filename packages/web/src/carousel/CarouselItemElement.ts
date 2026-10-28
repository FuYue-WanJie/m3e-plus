import { css, CSSResultGroup, html, LitElement } from "lit";

import { customElement } from "@wanjie/m3e-web/core";

/**
 * An item in a carousel.
 *
 * @description
 * `m3e-carousel-item` is laid out by its parent `m3e-carousel`. The carousel only ever resizes and
 * moves the item's rounded mask; the content inside keeps the full (focal) item size on its own
 * compositor layer and is counter-translated, so revealing more of a picture never re-rasterises it.
 * An optional label fades in as the item grows toward the focal size.
 *
 * @example
 * ```html
 * <m3e-carousel style="height: 220px">
 *   <m3e-carousel-item>
 *     <img src="lake.jpg" alt="Glacier lake" />
 *     <span slot="label">Glacier lake</span>
 *   </m3e-carousel-item>
 * </m3e-carousel>
 * ```
 *
 * @tag m3e-carousel-item
 *
 * @slot - The item content, usually an image; it is sized to the focal item and covers it.
 * @slot label - Text shown over a scrim on large items, faded out as the item shrinks.
 *
 * @cssprop --m3e-carousel-item-shape - Corner radius of the item mask.
 * @cssprop --m3e-carousel-item-container-color - Background behind the content.
 * @cssprop --m3e-carousel-item-label-color - Label text color.
 */
@customElement("m3e-carousel-item")
export class M3eCarouselItemElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      box-sizing: border-box;
      overflow: hidden;
      contain: strict;
      visibility: hidden;
      border-radius: var(--m3e-carousel-item-shape, var(--m3e-shape-corner-extra-large, 28px));
      background-color: var(--m3e-carousel-item-container-color, var(--md-sys-color-surface-container-highest, #e6e0e9));
      -webkit-tap-highlight-color: transparent;
    }
    :host([data-live]) {
      will-change: transform;
    }
    :host([hidden]) {
      display: none;
    }
    .content {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      contain: strict;
      /* its own layer that never changes size: moving the mask over it needs no re-raster */
      will-change: transform;
    }
    ::slotted(:not([slot])) {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .label {
      position: absolute;
      inset: auto 0 0 0;
      padding: 48px 16px 16px;
      color: var(--m3e-carousel-item-label-color, #fff);
      white-space: nowrap;
      pointer-events: none;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
      visibility: hidden;
    }
    .label.empty {
      display: none;
    }
  `;

  /** @private */ #content?: HTMLElement;
  /** @private */ #label?: HTMLElement;
  /** @private Last written values, so a frame only touches what changed. */
  readonly #last = { size: "", offset: NaN, label: NaN };

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    if (!this.hasAttribute("aria-roledescription")) this.setAttribute("aria-roledescription", "slide");
  }

  /** @inheritdoc */
  override render(): unknown {
    return html`<div class="content" part="content"><slot></slot></div>
      <div class="label empty" part="label"><slot name="label" @slotchange=${this.#onLabelChange}></slot></div>`;
  }

  /** @inheritdoc */
  protected override firstUpdated(): void {
    this.#content = this.renderRoot.querySelector<HTMLElement>(".content") ?? undefined;
    this.#label = this.renderRoot.querySelector<HTMLElement>(".label") ?? undefined;
    this.#last.size = "";
    this.#last.offset = NaN;
    this.#last.label = NaN;
  }

  /** @private */ #onLabelChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.#label?.classList.toggle("empty", slot.assignedNodes({ flatten: true }).length === 0);
  }

  /**
   * @internal Called by `m3e-carousel` on every frame the item moves.
   * @param pageSize The focal (unmasked) item size along the main axis.
   * @param offset Main-axis translation of the content relative to the mask.
   * @param label Label visibility, 0..1.
   * @param vertical Whether the carousel scrolls vertically.
   */
  _place(pageSize: number, offset: number, label: number, vertical: boolean): void {
    const content = this.#content;
    if (!content) return;
    const size = `${vertical ? 1 : 0}|${pageSize}`;
    if (this.#last.size !== size) {
      this.#last.size = size;
      content.style.width = vertical ? "100%" : `${pageSize}px`;
      content.style.height = vertical ? `${pageSize}px` : "100%";
      this.#last.offset = NaN;
    }
    if (this.#last.offset !== offset) {
      this.#last.offset = offset;
      content.style.transform = vertical ? `translate3d(0,${offset}px,0)` : `translate3d(${offset}px,0,0)`;
    }
    const labelEl = this.#label;
    if (!labelEl) return;
    // The label follows the mask's leading edge, not the content, so it stays readable while revealing.
    if (this.#last.label !== label) {
      this.#last.label = label;
      labelEl.style.opacity = String(label);
      labelEl.style.visibility = label > 0 ? "visible" : "hidden";
      labelEl.style.transform = label > 0 && !vertical ? `translate3d(0,${((1 - label) * 8).toFixed(1)}px,0)` : "";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-carousel-item": M3eCarouselItemElement;
  }
}
