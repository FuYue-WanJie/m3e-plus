import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, queryAssignedElements } from "lit/decorators.js";

import {
  PressedController,
  Role,
  isSelectedMixin,
  DesignToken,
  setCustomState,
  addCustomState,
  customElement,
  prefersReducedMotion,
  waitForUpgrade,
  waitForUpdate,
  setCustomEnumState,
  AttachInternals,
} from "@wanjie/m3e-web/core";

import { M3eButtonElement } from "@wanjie/m3e-web/button";
import { M3eIconButtonElement } from "@wanjie/m3e-web/icon-button";
import "@wanjie/m3e-web/menu";
import { SpringSimulation } from "@wanjie/m3e-web/physics";

import { ButtonGroupVariant, isButtonGroupVariant } from "./ButtonGroupVariant";
import { ButtonGroupSize, isButtonGroupSize } from "./ButtonGroupSize";
import { squeezeLayout } from "./squeeze";

/**
 * Organizes buttons and adds interactions between them.
 *
 * @description
 * The `m3e-button-group` component arranges multiple buttons into a unified, expressive layout,
 * supporting both `standard` and `connected` variants. It enables seamless, accessible grouping
 * of actions, adapts to various sizes, and ensures consistent spacing, shape, and alignment.
 * Designed according to Material 3 principles, it empowers users to interact with related actions
 * in a visually harmonious and intuitive way.
 *
 * @example
 * The following example illustrates a standard button group.
 * ``` html
 * <m3e-button-group>
 *  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_bold"></m3e-icon></m3e-icon-button>
 *  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_italic"></m3e-icon></m3e-icon-button>
 *  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_underlined"></m3e-icon></m3e-icon-button>
 * </m3e-button-group>
 * ```
 * @example
 * The next example illustrates a connected button group.
 * ```html
 * <m3e-button-group variant="connected">
 *  <m3e-button variant="tonal" shape="square" toggle>Start</m3e-button>
 *  <m3e-button variant="tonal" shape="square" toggle>Directions</m3e-button>
 *  <m3e-button variant="tonal" shape="square" toggle>Share</m3e-button>
 * </m3e-button-group>
 * ```
 *
 * @tag m3e-button-group
 *
 * @slot - Renders the buttons of the group.
 *
 * @attr multi - Whether multiple toggle buttons can be selected.
 * @attr overflow - Whether buttons that do not fit collapse into a trailing "more options" menu.
 * @attr size - The size of the group.
 * @attr variant - The appearance variant of the group.
 *
 * @cssprop --m3e-standard-button-group-extra-small-spacing - Spacing between buttons in standard variant, extra-small size.
 * @cssprop --m3e-standard-button-group-small-spacing - Spacing between buttons in standard variant, small size.
 * @cssprop --m3e-standard-button-group-medium-spacing - Spacing between buttons in standard variant, medium size.
 * @cssprop --m3e-standard-button-group-large-spacing - Spacing between buttons in standard variant, large size.
 * @cssprop --m3e-standard-button-group-extra-large-spacing - Spacing between buttons in standard variant, extra-large size.
 * @cssprop --m3e-connected-button-group-spacing - Spacing between buttons in connected variant.
 * @cssprop --m3e-connected-button-group-extra-small-inner-shape - Corner shape for connected variant, extra-small size.
 * @cssprop --m3e-connected-button-group-extra-small-inner-pressed-shape - Pressed corner shape for connected variant, extra-small size.
 * @cssprop --m3e-connected-button-group-small-inner-shape - Corner shape for connected variant, small size.
 * @cssprop --m3e-connected-button-group-small-inner-pressed-shape - Pressed corner shape for connected variant, small size.
 * @cssprop --m3e-connected-button-group-medium-inner-shape - Corner shape for connected variant, medium size.
 * @cssprop --m3e-connected-button-group-medium-inner-pressed-shape - Pressed corner shape for connected variant, medium size.
 * @cssprop --m3e-connected-button-group-large-inner-shape - Corner shape for connected variant, large size.
 * @cssprop --m3e-connected-button-group-large-inner-pressed-shape - Pressed corner shape for connected variant, large size.
 * @cssprop --m3e-connected-button-group-extra-large-inner-shape - Corner shape for connected variant, extra-large size.
 * @cssprop --m3e-connected-button-group-extra-large-inner-pressed-shape - Pressed corner shape for connected variant, extra-large size.
 */
@customElement("m3e-button-group")
export class M3eButtonGroupElement extends Role(AttachInternals(LitElement), "group") {
  /** The styles of the element. */
  static override styles: CSSResultGroup = css`
    :host {
      display: flex;
      vertical-align: middle;
      flex-wrap: nowrap;
      align-items: center;
    }
    :host([hidden]) {
      display: none;
    }
    .base {
      display: flex;
      vertical-align: middle;
      flex-wrap: nowrap;
      align-items: center;
    }
    :host(:is(:state(--standard), :--standard)) {
      justify-content: center;
    }
    :host(:is(:state(--connected), :--connected)) .base {
      flex: 1 1 auto;
    }
    :host(:is(:state(--standard), :--standard)) .base {
      width: fit-content;
      flex: none;
    }
    :host(:is(:state(--standard), :--standard):is(:state(--extra-small), :--extra-small)) .base {
      column-gap: var(--m3e-standard-button-group-extra-small-spacing, ${DesignToken.measurement.space225});
    }
    :host(:is(:state(--standard), :--standard):is(:state(--small), :--small)) .base {
      column-gap: var(--m3e-standard-button-group-small-spacing, ${DesignToken.measurement.space150});
    }
    :host(:is(:state(--standard), :--standard):is(:state(--medium), :--medium)).base {
      column-gap: var(--m3e-standard-button-group-medium-spacing, ${DesignToken.measurement.space100});
    }
    :host(:is(:state(--standard), :--standard):is(:state(--large), :--large)) .base {
      column-gap: var(--m3e-standard-button-group-large-spacing, ${DesignToken.measurement.space100});
    }
    :host(:is(:state(--standard), :--standard):is(:state(--extra-large), :--extra-large)) .base {
      column-gap: var(--m3e-standard-button-group-extra-large-spacing, ${DesignToken.measurement.space100});
    }
    :host(:is(:state(--connected), :--connected)) .base {
      column-gap: var(--m3e-connected-button-group-spacing, ${DesignToken.measurement.space25});
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(:is(:state(--first), :--first):is(:state(--extra-small), :--extra-small)),
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--extra-small), :--extra-small)
      ) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-extra-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-extra-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-end-shape-pressed-morph: var(
        --m3e-connected-button-group-extra-small-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(:is(:state(--last), :--last):is(:state(--extra-small), :--extra-small)),
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--extra-small), :--extra-small)
      ) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-extra-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-extra-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-start-shape-pressed-morph: var(
        --m3e-connected-button-group-extra-small-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(:is(:state(--first), :--first):is(:state(--extra-small), :--extra-small)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-extra-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-extra-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-small), :--extra-small))
      ::slotted(:is(:state(--last), :--last):is(:state(--extra-small), :--extra-small)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-extra-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-extra-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:is(:state(--first), :--first):is(:state(--small), :--small)),
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--small), :--small)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-end-shape-pressed-morph: var(
        --m3e-connected-button-group-small-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:is(:state(--last), :--last):is(:state(--small), :--small)),
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--small), :--small)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-small-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-start-shape-pressed-morph: var(
        --m3e-connected-button-group-small-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:is(:state(--first), :--first):is(:state(--small), :--small)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--small), :--small))
      ::slotted(:is(:state(--last), :--last):is(:state(--small), :--small)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-small-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(:is(:state(--first), :--first):is(:state(--medium), :--medium)),
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--medium), :--medium)
      ) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-medium-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-medium-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-end-shape-pressed-morph: var(
        --m3e-connected-button-group-medium-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(:is(:state(--last), :--last):is(:state(--medium), :--medium)),
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--medium), :--medium)
      ) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-medium-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-medium-inner-shape,
        ${DesignToken.shape.corner.small}
      );
      --_button-start-shape-pressed-morph: var(
        --m3e-connected-button-group-medium-inner-pressed-shape,
        ${DesignToken.shape.corner.extraSmall}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(:is(:state(--first), :--first):is(:state(--medium), :--medium)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-medium-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-medium-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--medium), :--medium))
      ::slotted(:is(:state(--last), :--last):is(:state(--medium), :--medium)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-medium-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-medium-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:is(:state(--first), :--first):is(:state(--large), :--large)),
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--large), :--large)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-large-inner-shape,
        ${DesignToken.shape.corner.large}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-large-inner-shape,
        ${DesignToken.shape.corner.large}
      );
      --_button-end-shape-pressed-morph: var(
        --m3e-connected-button-group-large-inner-pressed-shape,
        ${DesignToken.shape.corner.medium}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:is(:state(--last), :--last):is(:state(--large), :--large)),
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--large), :--large)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-large-inner-shape,
        ${DesignToken.shape.corner.large}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-large-inner-shape,
        ${DesignToken.shape.corner.large}
      );
      --_button-start-shape-pressed-morph: var(
        --m3e-connected-button-group-large-inner-pressed-shape,
        ${DesignToken.shape.corner.medium}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:is(:state(--first), :--first):is(:state(--large), :--large)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--large), :--large))
      ::slotted(:is(:state(--last), :--last):is(:state(--large), :--large)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(:is(:state(--first), :--first):is(:state(--extra-large), :--extra-large)),
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--extra-large), :--extra-large)
      ) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-extra-large-inner-shape,
        ${DesignToken.shape.corner.largeIncreased}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-extra-large-inner-shape,
        ${DesignToken.shape.corner.largeIncreased}
      );
      --_button-end-shape-pressed-morph: var(
        --m3e-connected-button-group-extra-large-inner-pressed-shape,
        ${DesignToken.shape.corner.large}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(:is(:state(--last), :--last):is(:state(--extra-large), :--extra-large)),
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(
        :not(:is(:state(--first), :--first)):not(:is(:state(--last), :--last)):is(:state(--extra-large), :--extra-large)
      ) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-extra-large-inner-shape,
        ${DesignToken.shape.corner.largeIncreased}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-extra-large-inner-shape,
        ${DesignToken.shape.corner.largeIncreased}
      );
      --_button-start-shape-pressed-morph: var(
        --m3e-connected-button-group-extra-large-inner-pressed-shape,
        ${DesignToken.shape.corner.large}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(:is(:state(--first), :--first):is(:state(--extra-large), :--extra-large)) {
      --_button-rounded-start-shape: var(
        --m3e-connected-button-group-extra-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-start-shape: var(
        --m3e-connected-button-group-extra-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    :host(:is(:state(--connected), :--connected):is(:state(--extra-large), :--extra-large))
      ::slotted(:is(:state(--last), :--last):is(:state(--extra-large), :--extra-large)) {
      --_button-rounded-end-shape: var(
        --m3e-connected-button-group-extra-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
      --_button-square-end-shape: var(
        --m3e-connected-button-group-extra-large-outer-shape,
        ${DesignToken.shape.corner.full}
      );
    }
    .overflow-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex: none;
      border: none;
      border-radius: ${DesignToken.shape.corner.full};
      background-color: var(--m3e-button-group-overflow-indicator-background, var(--md-sys-color-secondary-container, #e8def8));
      color: var(--m3e-button-group-overflow-indicator-color, var(--md-sys-color-on-secondary-container, #1d192b));
      cursor: pointer;
      padding: 0;
      box-sizing: border-box;
      outline-offset: 2px;
    }
    .overflow-indicator[hidden] {
      display: none;
    }
    .overflow-indicator svg {
      pointer-events: none;
    }
    .overflow-menu {
      display: none;
    }
    .overflow-menu:popover-open {
      display: block;
    }
    ::slotted([data-overflow-hidden]) {
      display: none;
    }
  `;

  /** @private Per-button press-width spring (FastSpatial 800 / 0.6, AndroidX EnlargeOnPress). */
  readonly #springs = new Map<M3eButtonElement | M3eIconButtonElement, SpringSimulation>();
  /** @private Cached natural (rest) widths in px, refreshed on content/resize changes. */
  #naturalWidths: number[] = [];
  /** @private Per-button compression limit (px) = trailing content padding. */
  #compressionLimits: number[] = [];
  /** @private rAF handle for the shared squeeze loop. */
  #squeezeRaf = 0;
  /** @private Per-button pending release "wait until progress > 0.75" frame handles. */
  readonly #releaseWait = new Map<M3eButtonElement | M3eIconButtonElement, number>();
  /** @private Whether natural widths need (re)measurement before the next layout. */
  #measureDirty = true;
  /** @private ResizeObserver watching the buttons' content to refresh natural widths. */
  #resizeObserver?: ResizeObserver;
  /** @private Whether the overflow menu is currently showing. */
  #overflowOpen = false;
  /** @private Indices (into `buttons`) currently collapsed into the overflow menu. */
  #collapsed = new Set<number>();
  /** @private Observer watching the group's available width to recompute the overflow fold. */
  #overflowObserver?: ResizeObserver;

  /** @private */ readonly #pressedController = new PressedController(this, {
    target: null,
    capture: true,
    minPressedDuration: 225,
    isPressedKey: (key) => key === " ",
    callback: (pressed, _point, target) => {
      const button = target as M3eButtonElement | M3eIconButtonElement | undefined;
      if (button) this.#handleButtonPress(button, pressed);
    },
  });

  /**
   * The appearance variant of the group.
   * @default "standard"
   */
  @property({ reflect: true, useDefault: true }) variant: ButtonGroupVariant = "standard";

  /**
   * The size of the group.
   * @default "small"
   */
  @property({ reflect: true, useDefault: true }) size: ButtonGroupSize = "small";

  /**
   * Whether multiple toggle buttons can be selected.
   * @default false
   */
  @property({ type: Boolean }) multi = false;

  /**
   * Whether buttons that do not fit the group's width collapse into an overflow menu
   * (an anchored `m3e-menu` behind a trailing "more options" icon button), as AndroidX
   * `ButtonGroup` does with its overflow indicator.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) overflow = false;

  /** The buttons contained by the group. */
  @queryAssignedElements({ slot: "", selector: "m3e-button,m3e-icon-button", flatten: true })
  readonly buttons!: ReadonlyArray<M3eButtonElement | M3eIconButtonElement>;

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();

    this.#applyVariant();
    this.#applySize();
    this.#observeOverflow();

    if (this.hasAttribute("disable-role")) {
      this.role = null;
    }
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#overflowObserver?.disconnect();
    this.#overflowObserver = undefined;
    if (this.#squeezeRaf) cancelAnimationFrame(this.#squeezeRaf);
    this.#squeezeRaf = 0;
    for (const raf of this.#releaseWait.values()) cancelAnimationFrame(raf);
    this.#releaseWait.clear();
    for (const spring of this.#springs.values()) spring.stop();
    this.#springs.clear();
    for (const b of this.buttons ?? []) {
      b.style.removeProperty("width");
      b.style.removeProperty("--_adjacent-shrink");
    }
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }

  /** @inheritdoc */
  protected override willUpdate(_changedProperties: PropertyValues<this>): void {
    super.willUpdate(_changedProperties);

    if (_changedProperties.has("variant")) {
      this.#applyVariant();
    }
    if (_changedProperties.has("size")) {
      this.#applySize();
    }
    if (_changedProperties.has("overflow")) {
      this.#observeOverflow();
      this.#updateOverflow();
    }
  }

  /** @inheritdoc */
  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has("multi") || changedProperties.has("variant")) {
      this.#updateButtons();
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return html`<div class="base">
      <slot @slotchange=${this.#updateButtons} @change=${this.#handleChange}></slot>
      <button
        class="overflow-indicator"
        part="overflow-indicator"
        ?hidden=${!this.overflow}
        aria-haspopup="menu"
        aria-expanded=${this.#overflowOpen ? "true" : "false"}
        aria-label="More options"
        @click=${this.#toggleOverflowMenu}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
            fill="currentColor"
          />
        </svg>
      </button>
      <m3e-menu class="overflow-menu" position-y="below" position-x="after" ?hidden=${!this.overflow}>
      </m3e-menu>
    </div>`;
  }

  /** @private */
  #applyVariant(): void {
    if (!isButtonGroupVariant(this.variant)) {
      this.variant = "standard";
    }
    setCustomEnumState(this, this.variant, "connected", "standard");
    // Connected groups do not squeeze; drop any squeeze left over from standard.
    if (this.variant === "connected") this.#clearSqueeze();
  }

  /** @private */
  #applySize(): void {
    if (!isButtonGroupSize(this.size)) {
      this.size = "small";
    }
    setCustomEnumState(this, this.size, "extra-large", "extra-small", "large", "medium", "small");
  }

  /** @private */
  async #updateButtons(): Promise<void> {
    const buttons = this.buttons;
    for (const target of this.#pressedController.targets) {
      this.#pressedController.unobserve(target);
    }
    for (const button of this.buttons) {
      await waitForUpgrade(button);
      await waitForUpdate(button);
    }
    const canToggle = [...buttons].some((x) => x.toggle);

    // disable-role is an internal attribute to by split-button to disable setting roles.
    if (!this.hasAttribute("disable-role")) {
      this.role = canToggle && !this.multi ? "radiogroup" : "group";
    }

    const buttonRole = this.role === "radiogroup" ? "radio" : "button";

    buttons.forEach((button, i) => {
      this.#pressedController.observe(button);
      setCustomState(button, "--connected", this.variant === "connected");
      addCustomState(button, "--grouped");
      setCustomState(button, "--first", i == 0);
      setCustomState(button, "--last", i == buttons.length - 1);

      if (!this.hasAttribute("disable-role") && button.role !== buttonRole && button.toggle) {
        const checked = !button.toggle ? null : button.selected ? "true" : "false";
        button.role = buttonRole;
        if (button.role === "button") {
          button.ariaPressed = checked;
          button.ariaChecked = null;
        } else {
          button.ariaChecked = checked;
          button.ariaPressed = null;
        }
      }
    });

    // Natural widths are stale after the button set changes; re-measure on the next press.
    this.#measureDirty = true;
    this.#naturalWidths = [];
    // Drop springs for buttons that are no longer in the group.
    for (const key of [...this.#springs.keys()]) {
      if (!buttons.includes(key)) {
        this.#springs.get(key)?.stop();
        this.#springs.delete(key);
      }
    }
    this.#observeResize();
  }

  /** @private */
  #handleChange(e: Event): void {
    if (this.multi || !(e.target instanceof HTMLElement)) return;
    if (e.target.tagName === "M3E-BUTTON" || e.target.tagName === "M3E-ICON-BUTTON") {
      if (!isSelectedMixin(e.target) || !e.target.selected) {
        return;
      }

      for (const button of this.buttons) {
        if (button === e.target || !button.selected) continue;
        button.selected = false;
      }
    }
  }

  // ── Press-squeeze (AndroidX EnlargeOnPress) ───────────────────────────────────────────────────

  /** @private Handle a per-button press change: drive its spring, squeeze neighbours. */
  #handleButtonPress(button: M3eButtonElement | M3eIconButtonElement, pressed: boolean): void {
    // Width squeeze only applies to the standard variant. Connected groups keep the press
    // shape morph handled by the buttons themselves but never change width (matches AndroidX
    // and the reference implementation). Clear any leftover squeeze if we were mid-animation.
    if (this.variant === "connected") {
      this.#clearSqueeze();
      return;
    }
    // Only 2+ buttons in a squeeze-eligible group participate.
    if (this.buttons.length < 2) return;
    // Reduced motion: no squeeze animation.
    if (prefersReducedMotion()) return;

    this.#ensureMeasured();
    const spring = this.#springFor(button);

    // Cancel any pending "wait until 0.75" release for this button.
    const wait = this.#releaseWait.get(button);
    if (wait != null) {
      cancelAnimationFrame(wait);
      this.#releaseWait.delete(button);
    }

    if (pressed) {
      spring.start(1, () => this.#requestLayout());
    } else {
      // AndroidX: on release wait until progress > 0.75 (if still climbing) then animate to 0.
      const tryRelease = (): void => {
        if (spring.value > 0.75 || !spring.isRunning) {
          this.#releaseWait.delete(button);
          spring.start(0, () => this.#requestLayout());
        } else {
          this.#releaseWait.set(button, requestAnimationFrame(tryRelease));
        }
      };
      tryRelease();
    }
    this.#requestLayout();
  }

  /** @private Get-or-create the press spring for a button (mid-flight state is preserved). */
  #springFor(button: M3eButtonElement | M3eIconButtonElement): SpringSimulation {
    let spring = this.#springs.get(button);
    if (!spring) {
      spring = new SpringSimulation({ stiffness: 800, dampingRatio: 0.6, value: 0 });
      this.#springs.set(button, spring);
    }
    return spring;
  }

  /** @private Stop all squeeze springs and drop any inline width/shrink (e.g. on variant switch). */
  #clearSqueeze(): void {
    if (this.#squeezeRaf) {
      cancelAnimationFrame(this.#squeezeRaf);
      this.#squeezeRaf = 0;
    }
    for (const raf of this.#releaseWait.values()) cancelAnimationFrame(raf);
    this.#releaseWait.clear();
    for (const spring of this.#springs.values()) spring.stop();
    this.#springs.clear();
    for (const b of this.buttons ?? []) {
      b.style.removeProperty("width");
      b.style.removeProperty("--_adjacent-shrink");
    }
  }

  /** @private Toggle the overflow menu (indicator click). */
  #toggleOverflowMenu = (): void => {
    if (this.#overflowOpen) {
      this.#hideOverflowMenu();
    } else {
      this.#showOverflowMenu();
    }
  };

  /** @private Show the overflow menu anchored to the indicator. */
  async #showOverflowMenu(): Promise<void> {
    const menu = this.#overflowMenu;
    const indicator = this.#overflowIndicator;
    if (!menu || !indicator) return;
    this.#overflowOpen = true;
    this.#syncOverflowIndicator();
    await menu.show(indicator);
  }

  /** @private Hide the overflow menu. */
  #hideOverflowMenu(): void {
    this.#overflowMenu?.hide();
    this.#overflowOpen = false;
    this.#syncOverflowIndicator();
  }

  /** @private Sync the indicator's expanded state. */
  #syncOverflowIndicator(): void {
    const indicator = this.#overflowIndicator;
    if (indicator) indicator.setAttribute("aria-expanded", this.#overflowOpen ? "true" : "false");
  }

  /**
   * @private Recompute which buttons fit. Buttons that do not fit are visually hidden and appear
   * as items in the overflow menu (clicking an item activates the original button). Runs only when
   * `overflow` is enabled; on `standard` groups the natural (unsqueezed) widths are used.
   */
  #updateOverflow(): void {
    const indicator = this.#overflowIndicator;
    if (!this.overflow) {
      if (this.#collapsed.size) {
        this.#collapsed.clear();
        this.#applyCollapsed();
        this.#syncMenuItems();
      }
      return;
    }
    const btns = this.buttons;
    if (!btns.length) {
      if (indicator) indicator.hidden = true;
      return;
    }
    if (indicator) indicator.hidden = false;
    // Available width: the group's content box minus the indicator (which always stays visible).
    const gap = this.#overflowGap();
    const styles = getComputedStyle(this);
    const available =
      this.getBoundingClientRect().width - parseFloat(styles.paddingLeft || "0") - parseFloat(styles.paddingRight || "0");
    const indicatorWidth = indicator ? indicator.getBoundingClientRect().width + gap : 0;

    // Measure natural widths with nothing collapsed.
    const widths = btns.map((b) => {
      const prevHidden = b.hasAttribute("data-overflow-hidden");
      if (prevHidden) b.removeAttribute("data-overflow-hidden");
      const w = b.getBoundingClientRect().width;
      if (prevHidden) b.setAttribute("data-overflow-hidden", "");
      return w;
    });

    // Greedy fold from the tail: keep as many leading buttons as fit.
    let used = indicatorWidth;
    let foldFrom = btns.length;
    for (let i = 0; i < btns.length; i++) {
      used += widths[i] + (i > 0 ? gap : 0);
      if (used > available + 0.5) {
        foldFrom = i;
        break;
      }
    }
    // If everything fits with room to spare, also try to show the last folded button again.
    const next = new Set<number>();
    if (foldFrom < btns.length) {
      for (let i = foldFrom; i < btns.length; i++) next.add(i);
    }
    this.#collapsed = next;
    this.#applyCollapsed();
    this.#syncMenuItems();
  }

  /** @private Column gap between items for the current variant/size (px). */
  #overflowGap(): number {
    const base = this.shadowRoot?.querySelector<HTMLElement>(".base");
    if (!base) return 0;
    return parseFloat(getComputedStyle(base).columnGap || "0") || 0;
  }

  /** @private Show/hide buttons per the current fold. */
  #applyCollapsed(): void {
    this.buttons.forEach((b, i) => {
      if (this.#collapsed.has(i)) b.setAttribute("data-overflow-hidden", "");
      else b.removeAttribute("data-overflow-hidden");
    });
  }

  /** @private Rebuild the overflow menu items from the collapsed buttons. */
  #syncMenuItems(): void {
    const menu = this.#overflowMenu;
    if (!menu) return;
    menu.innerHTML = "";
    const btns = this.buttons;
    let any = false;
    this.#collapsed.forEach((index) => {
      const b = btns[index];
      if (!b) return;
      any = true;
      const item = document.createElement("m3e-menu-item");
      const label = (b.textContent || "").trim() || b.getAttribute("aria-label") || `Item ${index + 1}`;
      item.textContent = label;
      item.addEventListener("click", () => {
        this.#hideOverflowMenu();
        b.click();
      });
      menu.appendChild(item);
    });
    menu.style.display = any ? "" : "none";
  }

  /** @private (Re)start the overflow ResizeObserver. */
  #observeOverflow(): void {
    this.#overflowObserver?.disconnect();
    this.#overflowObserver = undefined;
    if (!this.overflow || typeof ResizeObserver === "undefined") return;
    this.#overflowObserver = new ResizeObserver(() => this.#updateOverflow());
    this.#overflowObserver.observe(this);
  }

  /** @private The trailing overflow indicator button (shadow DOM). */
  get #overflowIndicator(): HTMLButtonElement | null {
    return this.shadowRoot?.querySelector<HTMLButtonElement>(".overflow-indicator") ?? null;
  }

  /** @private The internal overflow menu (shadow DOM). */
  get #overflowMenu(): any | null {
    return this.shadowRoot?.querySelector(".overflow-menu") ?? null;
  }

  /** @private Schedule one layout pass on the next frame (coalesces multiple spring updates). */
  #requestLayout(): void {
    if (this.#squeezeRaf) return;
    this.#squeezeRaf = requestAnimationFrame(() => {
      this.#squeezeRaf = 0;
      this.#applySqueeze();
    });
  }

  /**
   * @private Write the current squeeze widths. Reads natural widths (cached, measured off-frame) and
   * per-button spring values, then writes each button's inline width. Does NOT read layout here, so
   * it does not thrash. When all springs are at rest it clears the inline widths (back to natural).
   */
  #applySqueeze(): void {
    const btns = this.buttons;
    if (btns.length < 2 || this.#naturalWidths.length !== btns.length) return;
    const progresses = btns.map((b) => this.#springs.get(b)?.value ?? 0);
    const anyActive = progresses.some((p) => p > 1e-4) || btns.some((b) => this.#springs.get(b)?.isRunning);
    if (!anyActive) {
      for (const b of btns) {
        b.style.removeProperty("width");
        b.style.removeProperty("--_adjacent-shrink");
      }
      return;
    }
    const widths = squeezeLayout(this.#naturalWidths, progresses, this.#compressionLimits, 0.15);
    btns.forEach((b, i) => {
      b.style.width = `${widths[i]}px`;
      // A squeezed button gives up its padding (never its content), so the label is not clipped.
      const shrink = Math.max(0, this.#naturalWidths[i] - widths[i]);
      if (shrink > 0.01) b.style.setProperty("--_adjacent-shrink", `${shrink}px`);
      else b.style.removeProperty("--_adjacent-shrink");
    });
  }

  /** @private Measure natural widths + compression limits once (lazily / after content changes). */
  #ensureMeasured(): void {
    const btns = this.buttons;
    if (!this.#measureDirty && this.#naturalWidths.length === btns.length) return;
    // Never (re)measure while any squeeze spring is mid-flight: reading widths during the
    // returning animation would capture a squeezed width as the "natural" baseline and the group
    // would shrink a little more on every rapid re-tap. Keep the last good baseline instead.
    const animating = btns.some((b) => {
      const s = this.#springs.get(b);
      return s != null && (s.isRunning || s.value > 1e-4);
    });
    if (animating && this.#naturalWidths.length === btns.length) return;
    this.#measureDirty = false;
    // Temporarily clear any inline widths so we read the natural content width.
    const prev = btns.map((b) => [b.style.width, b.style.getPropertyValue("--_adjacent-shrink")]);
    btns.forEach((b) => {
      b.style.removeProperty("width");
      b.style.removeProperty("--_adjacent-shrink");
    });
    this.#naturalWidths = btns.map((b) => b.getBoundingClientRect().width);
    this.#compressionLimits = btns.map((b) => {
      // AndroidX default compressionLimit = contentPadding end. m3e buttons put their horizontal
      // padding on the inner `.wrapper`, so read that; fall back to a sane 16px cap.
      const wrapper = b.shadowRoot?.querySelector<HTMLElement>(".wrapper");
      let pad = 0;
      if (wrapper) {
        const cs = getComputedStyle(wrapper);
        const isRtl = getComputedStyle(b).direction === "rtl";
        pad = parseFloat(isRtl ? cs.paddingLeft : cs.paddingRight) || 0;
      }
      if (pad <= 0) pad = 16;
      return pad;
    });
    // Restore (the next layout will overwrite anyway, but avoid a visible flash).
    btns.forEach((b, i) => {
      if (prev[i][0]) b.style.width = prev[i][0];
      if (prev[i][1]) b.style.setProperty("--_adjacent-shrink", prev[i][1]);
    });
  }

  /** @private (Re)start the resize observer that marks natural widths dirty on content change. */
  #observeResize(): void {
    this.#resizeObserver?.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    this.#resizeObserver = new ResizeObserver(() => {
      // Content changed -> recompute natural widths next press. Debounce via dirty flag; do not
      // layout here (avoids feedback with our own width writes, which change box size but not
      // intrinsic content width — we only need to re-measure when the button count/labels change,
      // which fires as a target list change; observing the group is a cheap safety net).
      this.#measureDirty = true;
    });
    // Observe the group box, not individual buttons: individual buttons change size during our own
    // width animation, which would self-trigger. The group's outer box is conserved during squeeze,
    // so this only fires on real layout changes (content, container resize).
    this.#resizeObserver.observe(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-button-group": M3eButtonGroupElement;
  }
}
