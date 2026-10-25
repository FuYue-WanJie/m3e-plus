import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, query, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import {
  addCustomState,
  AttachInternals,
  customElement,
  deleteCustomState,
  DesignToken,
  hasCustomState,
  prefersReducedMotion,
  ResizeController,
  setCustomEnumState,
} from "@wanjie/m3e-web/core";

import { M3eDirectionality, SupportsDirectionality } from "@wanjie/m3e-web/core/bidi";

import { M3eSliderThumbElement } from "./SliderThumbElement";
import { isSliderOrientation, SliderOrientation } from "./SliderOrientation";
import { isSliderSize, SliderSize } from "./SliderSize";
import { sliderValueFraction } from "./slider-track";

/**
 * Allows for the selection of numeric values from a range.
 *
 * @description
 * The `m3e-slider` component enables users to select a numeric value from a continuous or discrete range.
 * Designed according to Material 3 principles, it supports labeled value indicators, tick marks, and
 * snapping behavior.
 *
 * @example
 * The following example illustrates a labelled slider with thumb used to select a single numeric value.
 * ```html
 * <m3e-slider labelled>
 *  <m3e-slider-thumb value="50"></m3e-slider-thumb>
 * </m3e-slider>
 * ```
 *
 * @example
 * The next example illustrates a labelled range slider with two thumbs used to select a minimum and maximum numeric value.
 * ```html
 * <m3e-slider labelled>
 *  <m3e-slider-thumb value="25"></m3e-slider-thumb>
 *  <m3e-slider-thumb value="75"></m3e-slider-thumb>
 * </m3e-slider>
 * ```
 *
 * @example
 * The next example illustrates a vertical slider. Values run bottom-to-top.
 * ```html
 * <m3e-slider orientation="vertical" labelled>
 *  <m3e-slider-thumb value="40"></m3e-slider-thumb>
 * </m3e-slider>
 * ```
 *
 * @tag m3e-slider
 *
 * @slot - Renders the thumbs of the slider.
 *
 * @attr disabled - Whether the element is disabled.
 * @attr discrete - Whether to show tick marks.
 * @attr centered - Whether the active track fills from the centre of the range outwards.
 * @attr labelled - Whether to show value labels when activated.
 * @attr max - The maximum allowable value.
 * @attr min - The minimum allowable value.
 * @attr orientation - The orientation of the slider.
 * @attr step - The value at which the thumb will snap.
 * @attr steps - The number of discrete divisions between the endpoints (AndroidX semantics).
 * @attr size - The size of the slider.
 *
 * @fires beforeinput - Dispatched before the value of a thumb changes.
 * @fires input - Dispatched when the value of a thumb changes.
 * @fires change - Dispatched when the value of a thumb changes.
 *
 * @cssprop --m3e-slider-min-width - Minimum inline size of the slider host.
 * @cssprop --m3e-slider-small-height - Height of the slider when size is small or extra-small.
 * @cssprop --m3e-slider-medium-height - Height of the slider when size is medium.
 * @cssprop --m3e-slider-large-height - Height of the slider when size is large.
 * @cssprop --m3e-slider-extra-large-height - Height of the slider when size is extra-large.
 * @cssprop --m3e-slider-small-active-track-shape - Corner shape of the active track for small sliders.
 * @cssprop --m3e-slider-small-inactive-active-track-start-shape - Corner shape of the inactive track start for small sliders.
 * @cssprop --m3e-slider-small-inactive-track-end-shape - Corner shape of the inactive track end for small sliders.
 * @cssprop --m3e-slider-medium-active-track-shape - Corner shape of the active track for medium sliders.
 * @cssprop --m3e-slider-medium-inactive-active-track-start-shape - Corner shape of the inactive track start for medium sliders.
 * @cssprop --m3e-slider-medium-inactive-track-end-shape - Corner shape of the inactive track end for medium sliders.
 * @cssprop --m3e-slider-large-active-track-shape - Corner shape of the active track for large sliders.
 * @cssprop --m3e-slider-large-inactive-active-track-start-shape - Corner shape of the inactive track start for large sliders.
 * @cssprop --m3e-slider-large-inactive-track-end-shape - Corner shape of the inactive track end for large sliders.
 * @cssprop --m3e-slider-extra-large-active-track-shape - Corner shape of the active track for extra-large sliders.
 * @cssprop --m3e-slider-extra-large-inactive-active-track-start-shape - Corner shape of the inactive track start for extra-large sliders.
 * @cssprop --m3e-slider-extra-large-inactive-track-end-shape - Corner shape of the inactive track end for extra-large sliders.
 * @cssprop --m3e-slider-extra-small-track-height - Height of the track for extra-small sliders.
 * @cssprop --m3e-slider-small-track-height - Height of the track for small sliders.
 * @cssprop --m3e-slider-medium-track-height - Height of the track for medium sliders.
 * @cssprop --m3e-slider-large-track-height - Height of the track for large sliders.
 * @cssprop --m3e-slider-extra-large-track-height - Height of the track for extra-large sliders.
 * @cssprop --m3e-slider-tick-size - Size of each tick mark.
 * @cssprop --m3e-slider-tick-shape - Corner shape of each tick mark.
 * @cssprop --m3e-slider-inactive-track-color - Background color of the inactive track when enabled.
 * @cssprop --m3e-slider-disabled-inactive-track-color - Base color of the inactive track when disabled.
 * @cssprop --m3e-slider-disabled-inactive-track-opacity - Opacity of the inactive track when disabled.
 * @cssprop --m3e-slider-active-track-color - Background color of the active track when enabled.
 * @cssprop --m3e-slider-disabled-active-track-color - Base color of the active track when disabled.
 * @cssprop --m3e-slider-disabled-active-track-opacity - Opacity of the active track when disabled.
 * @cssprop --m3e-slider-tick-active-color - Color of active ticks when enabled.
 * @cssprop --m3e-slider-disabled-tick-active-color - Color of active ticks when disabled.
 * @cssprop --m3e-slider-tick-inactive-color - Color of inactive ticks when enabled.
 * @cssprop --m3e-slider-disabled-tick-inactive-color - Color of inactive ticks when disabled.
 */
@customElement("m3e-slider")
export class M3eSliderElement extends SupportsDirectionality(AttachInternals(LitElement)) {
  /** The styles of the element. */
  static override styles: CSSResultGroup = css`
    :host {
      display: inline-block;
      vertical-align: middle;
      min-inline-size: var(--m3e-slider-min-width, 200px);
      user-select: none;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      line-height: 0;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:not([disabled])) {
      cursor: pointer;
    }
    :host(:is(:state(--extra-small), :--extra-small)),
    :host(:is(:state(--small), :--small)) {
      height: var(--m3e-slider-small-height, 44px);
    }
    :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--extra-small), :--extra-small)) .base,
    :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--small), :--small)) .base {
      --_slider-active-track-shape: var(--m3e-slider-small-active-track-shape, ${DesignToken.shape.corner.smallStart});
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-small-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.smallStart}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-small-inactive-track-end-shape,
        ${DesignToken.shape.corner.smallEnd}
      );
    }
    :host(:is(:state(--rtl), :--rtl):is(:state(--extra-small), :--extra-small)) .base,
    :host(:is(:state(--rtl), :--rtl):is(:state(--small), :--small)) .base {
      --_slider-active-track-shape: var(--m3e-slider-small-active-track-shape, ${DesignToken.shape.corner.smallEnd});
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-small-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.smallEnd}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-small-inactive-track-end-shape,
        ${DesignToken.shape.corner.smallStart}
      );
    }
    :host(:is(:state(--extra-small), :--extra-small)) .track {
      height: calc(var(--m3e-slider-extra-small-track-height, 16px));
    }
    :host(:is(:state(--small), :--small)) .track {
      height: calc(var(--m3e-slider-small-track-height, 24px));
    }
    :host(:is(:state(--medium), :--medium)) {
      height: var(--m3e-slider-medium-height, 52px);
    }
    :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--medium), :--medium)) .base {
      --_slider-active-track-shape: var(
        --m3e-slider-medium-active-track-shape,
        ${DesignToken.shape.corner.mediumStart}
      );
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-medium-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.mediumStart}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-medium-inactive-track-end-shape,
        ${DesignToken.shape.corner.mediumEnd}
      );
    }
    :host(:is(:state(--rtl), :--rtl):is(:state(--medium), :--medium)) .base {
      --_slider-active-track-shape: var(--m3e-slider-medium-active-track-shape, ${DesignToken.shape.corner.mediumEnd});
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-medium-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.mediumEnd}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-medium-inactive-track-end-shape,
        ${DesignToken.shape.corner.mediumStart}
      );
    }
    :host(:is(:state(--medium), :--medium)) .track {
      height: var(--m3e-slider-medium-track-height, 40px);
    }
    :host(:is(:state(--large), :--large)) {
      height: var(--m3e-slider-large-height, 68px);
    }
    :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--large), :--large)) .base {
      --_slider-active-track-shape: var(--m3e-slider-large-active-track-shape, ${DesignToken.shape.corner.largeStart});
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-large-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.largeStart}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-large-inactive-track-end-shape,
        ${DesignToken.shape.corner.largeEnd}
      );
    }
    :host(:is(:state(--rtl), :--rtl):is(:state(--large), :--large)) .base {
      --_slider-active-track-shape: var(--m3e-slider-large-active-track-shape, ${DesignToken.shape.corner.largeEnd});
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-large-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.largeEnd}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-large-inactive-track-end-shape,
        ${DesignToken.shape.corner.largeStart}
      );
    }
    :host(:is(:state(--large), :--large)) .track {
      height: var(--m3e-slider-large-track-height, 56px);
    }
    :host(:is(:state(--extra-large), :--extra-large)) {
      height: var(--m3e-slider-extra-large-height, 108px);
    }
    :host(:not(:is(:state(--rtl), :--rtl)):is(:state(--extra-large), :--extra-large)) .base {
      --_slider-active-track-shape: var(
        --m3e-slider-extra-large-active-track-shape,
        ${DesignToken.shape.corner.extraLargeStart}
      );
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-extra-large-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.extraLargeStart}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-extra-large-inactive-track-end-shape,
        ${DesignToken.shape.corner.extraLargeEnd}
      );
    }
    :host(:is(:state(--rtl), :--rtl):is(:state(--extra-large), :--extra-large)) .base {
      --_slider-active-track-shape: var(
        --m3e-slider-extra-large-active-track-shape,
        ${DesignToken.shape.corner.extraLargeEnd}
      );
      --_slider-inactive-track-start-shape: var(
        --m3e-slider-extra-large-inactive-active-track-start-shape,
        ${DesignToken.shape.corner.extraLargeEnd}
      );
      --_slider-inactive-track-end-shape: var(
        --m3e-slider-extra-large-inactive-track-end-shape,
        ${DesignToken.shape.corner.extraLargeStart}
      );
    }
    :host(:is(:state(--extra-large), :--extra-large)) .track {
      height: var(--m3e-slider-extra-large-track-height, 96px);
    }
    .base {
      contain: layout style;
      display: inline-flex;
      align-items: center;
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      outline: none;
      touch-action: none;
      /* Small corner used where a track segment meets another segment or the thumb gap, matching
         AndroidX TrackInsideCornerSize (2dp). Overridable per element. */
      --_slider-inside-corner: var(--m3e-slider-inside-corner, 2px);
    }
    /* Track: three percentage-positioned segments (inactive head / active / inactive tail) inset by
       half a thumb along the axis, following the verified centred-slider geometry. Segment widths come
       from --_start-w / --_active-l / --_active-w / --_end-w set by the element. The outer radius
       (default half the track height) rounds the two outer ends; the inner radius rounds the seams. */
    .track {
      position: absolute;
      inset-inline: 0;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      touch-action: none;
      /* Cross-axis thickness comes from the per-size track height/width rules. */
      --_outer-r: var(--m3e-slider-track-outer-radius, calc(var(--_track-h, 16px) / 2));
      --_inner-r: var(--m3e-slider-track-inner-radius, 2px);
    }
    :host([orientation="vertical"]) .track {
      inset-inline: 0;
      left: 50%;
      right: auto;
      top: 0;
      bottom: 0;
      transform: translateX(-50%);
    }
    .track .seg {
      position: absolute;
      inset-block: 0;
    }
    :host([orientation="vertical"]) .track .seg {
      inset-block: auto;
      inset-inline: 0;
      left: 0;
      right: 0;
    }
    /* Inactive head 0..lo: outer corner on the start end, inner corner on the seam end. */
    .track .inactive.start {
      inset-inline-start: 0;
      width: var(--_start-w, 0%);
      border-start-start-radius: var(--_outer-r);
      border-end-start-radius: var(--_outer-r);
      border-start-end-radius: var(--_inner-r);
      border-end-end-radius: var(--_inner-r);
    }
    /* Active lo..hi: inner corners at both ends (a slim bar, not a capsule). */
    .track .active {
      inset-inline-start: var(--_active-l, 0%);
      width: var(--_active-w, 0%);
      border-radius: var(--_inner-r);
    }
    /* Inactive tail hi..1: inner corner on the seam end, outer corner on the end. */
    .track .inactive.end {
      inset-inline-end: 0;
      width: var(--_end-w, 0%);
      border-start-start-radius: var(--_inner-r);
      border-end-start-radius: var(--_inner-r);
      border-start-end-radius: var(--_outer-r);
      border-end-end-radius: var(--_outer-r);
    }
    :host([orientation="vertical"]) .track .inactive.start {
      inset-inline-start: auto;
      inset-block-start: 0;
      height: var(--_start-w, 0%);
      width: 100%;
      border-start-start-radius: var(--_inner-r);
      border-end-start-radius: var(--_outer-r);
      border-start-end-radius: var(--_inner-r);
      border-end-end-radius: var(--_outer-r);
    }
    :host([orientation="vertical"]) .track .active {
      inset-inline-start: 0;
      inset-block-start: var(--_active-l, 0%);
      height: var(--_active-w, 0%);
      width: 100%;
    }
    :host([orientation="vertical"]) .track .inactive.end {
      inset-inline-end: auto;
      inset-block-end: 0;
      height: var(--_end-w, 0%);
      width: 100%;
      border-start-start-radius: var(--_outer-r);
      border-end-start-radius: var(--_inner-r);
      border-start-end-radius: var(--_outer-r);
      border-end-end-radius: var(--_inner-r);
    }
    /* Step / stop ticks: small dots centred across the track at each anchor. */
    .track .tick {
      position: absolute;
      top: 50%;
      inset-inline-start: var(--_tick-pos, 0%);
      width: var(--m3e-slider-tick-size, 4px);
      height: var(--m3e-slider-tick-size, 4px);
      margin-inline-start: calc(var(--m3e-slider-tick-size, 4px) / -2);
      margin-block-start: calc(var(--m3e-slider-tick-size, 4px) / -2);
      border-radius: var(--m3e-slider-tick-shape, ${DesignToken.shape.corner.full});
      transform: none;
    }
    :host([orientation="vertical"]) .track .tick {
      top: auto;
      inset-inline-start: 50%;
      inset-block-start: var(--_tick-pos, 0%);
      margin-inline-start: calc(var(--m3e-slider-tick-size, 4px) / -2);
      margin-block-start: calc(var(--m3e-slider-tick-size, 4px) / -2);
    }
    .track .tick.hidden {
      visibility: hidden;
    }
    :host(:not([disabled])) .track .inactive {
      background: var(--m3e-slider-inactive-track-color, ${DesignToken.color.secondaryContainer});
    }
    :host([disabled]) .track .inactive {
      background: color-mix(
        in srgb,
        var(--m3e-slider-disabled-inactive-track-color, ${DesignToken.color.onSurface})
          var(--m3e-slider-disabled-inactive-track-opacity, 12%),
        transparent
      );
    }
    :host(:not([disabled])) .track .active {
      background: var(--m3e-slider-active-track-color, ${DesignToken.color.primary});
    }
    :host([disabled]) .track .active {
      background: color-mix(
        in srgb,
        var(--m3e-slider-disabled-active-track-color, ${DesignToken.color.onSurface})
          var(--m3e-slider-disabled-active-track-opacity, 38%),
        transparent
      );
    }
    /* AndroidX SliderDefaults cross-maps tick colours to the opposite track role. */
    :host(:not([disabled])) .track .tick.active {
      background: var(--m3e-slider-tick-active-color, ${DesignToken.color.secondaryContainer});
    }
    :host([disabled]) .track .tick.active {
      background: color-mix(
        in srgb,
        var(--m3e-slider-disabled-tick-active-color, ${DesignToken.color.onSurface})
          var(--m3e-slider-disabled-tick-active-opacity, 12%),
        transparent
      );
    }
    :host(:not([disabled])) .track .tick.inactive {
      background: var(--m3e-slider-tick-inactive-color, ${DesignToken.color.primary});
    }
    :host([disabled]) .track .tick.inactive {
      background: color-mix(
        in srgb,
        var(--m3e-slider-disabled-tick-inactive-color, ${DesignToken.color.onSurface})
          var(--m3e-slider-disabled-tick-inactive-opacity, 38%),
        transparent
      );
    }
    :host(:not([discrete])) .track .tick.active {
      display: none;
    }
    :host(:hover[labelled]) .base,
    :host(:focus-within[labelled]) .base {
      --_slider-label-visibility: visible;
      --_slider-label-opacity: 1;
      --_slider-label-transform: scale(1);
    }
    @media (forced-colors: active) {
      :host(:not([disabled])) .track .inactive {
        background: CanvasText;
      }
      :host(:not([disabled])) .track .active {
        background: Highlight;
      }
      :host(:not([disabled])) .track .tick.inactive {
        background: CanvasText;
      }
      :host(:not([disabled])) .track .tick.active {
        background: Canvas;
      }
      :host([disabled]) .track .inactive,
      :host([disabled]) .track .active {
        background: GrayText;
      }
    }

    /* ── Vertical orientation ────────────────────────────────────────────────
       Everything above lays the slider out along the inline axis. These rules
       re-map it to the block axis and are deliberately additive: they come last
       and so win on source order, which keeps the horizontal path untouched.

       Segments are anchored with bottom rather than margin-inline-start because a
       vertical slider runs bottom-to-top, so the offsets the element writes —
       measured from the end holding the minimum — already point the right way.
       The five --_slider-* custom properties are plain lengths and need no
       change; only the property they feed does.

       Corner radii are composed from the symmetric corner tokens rather than the
       Start/End ones, whose 4-value radii round the inline edges. */
    :host(:is(:state(--vertical), :--vertical)) {
      min-inline-size: auto;
      min-block-size: var(--m3e-slider-min-width, 200px);
      /* Containing block for .base below. */
      position: relative;
    }
    /* .base is taken out of flow rather than sized with height: 100%. A vertical
       host has no definite block size of its own - its height comes from
       min-block-size, from a flex parent, or from the consumer - and a percentage
       height resolves against the parent's *computed* height, which is auto. That
       collapses .base to zero and takes the track and both thumbs with it, since
       .base is their containing block. Insets resolve against the used height, so
       they work in every case. */
    :host(:is(:state(--vertical), :--vertical)) .base {
      position: absolute;
      inset: 0;
      width: auto;
      height: auto;
      flex-direction: column;
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--extra-small), :--extra-small)),
    :host(:is(:state(--vertical), :--vertical):is(:state(--small), :--small)) {
      height: auto;
      width: var(--m3e-slider-small-height, 44px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--extra-small), :--extra-small)) .track {
      height: auto;
      width: calc(var(--m3e-slider-extra-small-track-height, 16px));
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--small), :--small)) .track {
      height: auto;
      width: calc(var(--m3e-slider-small-track-height, 24px));
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--medium), :--medium)) {
      height: auto;
      width: var(--m3e-slider-medium-height, 52px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--medium), :--medium)) .track {
      height: auto;
      width: var(--m3e-slider-medium-track-height, 40px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--large), :--large)) {
      height: auto;
      width: var(--m3e-slider-large-height, 68px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--large), :--large)) .track {
      height: auto;
      width: var(--m3e-slider-large-track-height, 56px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--extra-large), :--extra-large)) {
      height: auto;
      width: var(--m3e-slider-extra-large-height, 108px);
    }
    :host(:is(:state(--vertical), :--vertical):is(:state(--extra-large), :--extra-large)) .track {
      height: auto;
      width: var(--m3e-slider-extra-large-track-height, 96px);
    }
  `;

  /** @private */ #directionalitySubscription?: () => void;

  /** @private */
  @query(".base") private readonly _base?: HTMLElement;

  /** @private */
  @query(".track") private readonly _track?: HTMLElement;

  /** Step / stop tick descriptors rendered inside the track. @private */
  @state() private _ticks = new Array<{ value: number; active: boolean; hidden: boolean }>();

  /** @private */ readonly #changedThumbs = new Set<M3eSliderThumbElement>();
  /** @private */ #thumbs = new Array<M3eSliderThumbElement>();
  /** @private */ #activeThumb?: M3eSliderThumbElement;
  /** @private Extent of the slider along its own axis. */ #cachedSize = 0;
  /** @private Extent of a thumb along the slider's axis. */ #cachedThumbSize = 0;
  /** @private Client coordinate of the axis start edge — left when horizontal, top when vertical. */
  #cachedClientStart = 0;
  /** @private Client coordinate of the axis end edge — right when horizontal, bottom when vertical. */
  #cachedClientEnd = 0;
  /** @private Extent of the slider's bounding rect along its own axis. */ #cachedClientSize = 0;
  /** @private */ #lastThumbMoveTimestamp = 0;

  constructor() {
    super();
    new ResizeController(this, { callback: () => this.#updateDimensions(true) });
  }

  /**
   * The orientation of the slider.
   * @default "horizontal"
   */
  @property({ reflect: true, useDefault: true })
  orientation: SliderOrientation = "horizontal";

  /**
   * The size of the slider.
   * @default "extra-small"
   */
  @property({ reflect: true, useDefault: true }) size: SliderSize = "extra-small";

  /**
   * Whether the element is disabled.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * Whether to show tick marks.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) discrete = false;

  /**
   * The minimum allowable value.
   * @default 0
   */
  @property({ type: Number }) min = 0;

  /**
   * The maximum allowable value.
   * @default 100
   */
  @property({ type: Number }) max = 100;

  /**
   * The value at which the thumb will snap.
   * @default 1
   */
  @property({ type: Number }) step = 1;

  /**
   * The number of discrete divisions between the endpoints, matching AndroidX Compose's `steps`
   * parameter. When positive this takes precedence over `step`: the value snaps to `steps + 2`
   * evenly-spaced anchors across `[min, max]` (i.e. the endpoints plus `steps` interior stops).
   * For example, a range of 0..10 with `steps="4"` snaps to 0, 2, 4, 6, 8, 10.
   * @default 0
   */
  @property({ type: Number }) steps = 0;

  /**
   * Whether the active track fills from the centre of the range outwards (a "centered" slider),
   * rather than from the minimum end. The centre is the value `0` when it lies within `[min, max]`,
   * otherwise the midpoint of the range. Only applies to single-thumb sliders.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) centered = false;

  /**
   * Whether to show value labels when activated.
   * @default false
   */
  @property({ type: Boolean }) labelled = false;

  /** The function used to format display values. */
  @property({ attribute: false }) displayWith: ((value: number | null) => string) | null = null;

  /**
   * Whether the slider is laid out along the block axis.
   * @private
   */
  get #vertical(): boolean {
    return this.orientation === "vertical";
  }

  /** The thumbs used to select values. */
  get thumbs(): readonly M3eSliderThumbElement[] {
    return this.#thumbs;
  }

  /** Whether the slider is a range slider. */
  get isRange(): boolean {
    return this.#thumbs.length > 1;
  }

  /** The thumb used to select a value. */
  get thumb(): M3eSliderThumbElement | null {
    return this.#thumbs[0] ?? null;
  }

  /** The thumb used to select the lower value of a range slider. */
  get lowerThumb(): M3eSliderThumbElement | null {
    return this.thumb;
  }

  /** The thumb used to select the upper value of a range slider. */
  get upperThumb(): M3eSliderThumbElement | null {
    return this.#thumbs[1] ?? null;
  }

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();

    this.#applySize();
    this.#applyOrientation();
    this.#directionalitySubscription = M3eDirectionality.observe(() => {
      this.#updateDimensions(true);
      this.requestUpdate();
    });
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#changedThumbs.clear();
    this.#directionalitySubscription?.();
  }

  /** @inheritdoc */
  protected override willUpdate(_changedProperties: PropertyValues<this>): void {
    super.willUpdate(_changedProperties);

    if (_changedProperties.has("size")) {
      this.#applySize();
    }
    if (_changedProperties.has("orientation")) {
      this.#applyOrientation();
    }
  }

  /** @inheritdoc */
  protected override updated(_changedProperties: PropertyValues<this>): void {
    super.updated(_changedProperties);

    if (_changedProperties.has("disabled")) {
      this.#thumbs.forEach((x) => (x.disabled = this.disabled));
    }
    if (_changedProperties.has("orientation")) {
      // The axis changed, so every cached measurement and every thumb transform
      // now describes the wrong one.
      this.#updateThumbs();
      this.#updateDimensions(true);
    }
    // Snapping / tick geometry and centred fill all depend on the range and stepping.
    if (
      _changedProperties.has("min") ||
      _changedProperties.has("max") ||
      _changedProperties.has("step") ||
      _changedProperties.has("steps") ||
      _changedProperties.has("centered") ||
      _changedProperties.has("discrete")
    ) {
      this.#syncThumbValues();
      this.#updateThumbs();
      this.#updateDimensions(true);
    }
    // `displayWith` affects the accessible value text, so refresh the thumbs' aria-valuetext.
    if (_changedProperties.has("displayWith")) {
      this.#updateThumbs();
    }
  }

  /**
   * Re-clamps/snaps existing thumb values into the current range so changing `min`/`max`/`steps`
   * never leaves a thumb out of bounds or off an anchor.
   * @private
   */
  #syncThumbValues(): void {
    const lower = this.min;
    const upper = this.max;
    let previousMax = lower;
    for (const thumb of this.#thumbs) {
      if (thumb.value == null) continue;
      const snapped = Math.min(upper, Math.max(Math.max(lower, previousMax), this.#snapValue(thumb.value)));
      if (snapped !== thumb.value) thumb.value = snapped;
      previousMax = snapped;
    }
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return html`<div
      class="base"
      tabindex="${ifDefined(!this.disabled ? "-1" : undefined)}"
      @pointerdown=${this.#handlePointerDown}
      @pointermove=${this.#handlePointerMove}
      @pointerup=${this.#handlePointerUp}
      @keydown=${this.#handleKeyDown}
      @keyup=${this.#handleKeyUp}
      @value-change=${this.#handleThumbChange}
    >
      <div class="track" aria-hidden="true">
        <span class="seg inactive start"></span>
        <span class="seg active"></span>
        <span class="seg inactive end"></span>
        ${this._ticks.map((t) => this.#renderTick(t))}
      </div>
      <slot @slotchange=${this.#handleSlotChange}></slot>
    </div>`;
  }

  /** @private */
  #applySize(): void {
    if (!isSliderSize(this.size)) {
      this.size = "extra-small";
    }
    setCustomEnumState(this, this.size, "extra-large", "extra-small", "large", "medium", "small");
  }

  /** @private */
  #applyOrientation(): void {
    if (!isSliderOrientation(this.orientation)) {
      this.orientation = "horizontal";
    }
    setCustomEnumState(this, this.orientation, "horizontal", "vertical");
  }

  /** @private */
  #handleSlotChange(e: Event): void {
    this.#thumbs = (<HTMLSlotElement>e.target)
      .assignedElements({ flatten: true })
      .filter((x) => x instanceof M3eSliderThumbElement);

    if (this.#thumbs.length > 2) {
      this.#thumbs.length = 2;
    }

    this.#updateThumbs();
  }

  /** @private */
  #updateThumbs(): void {
    this.#thumbs.forEach((thumb, i) => {
      if (this.disabled) {
        thumb.disabled = true;
      }
      const value = thumb.value ?? this.#thumbs[i - 1]?.value ?? this.min;
      thumb.ariaValueMin = `${this.#thumbs[i - 1]?.value ?? this.min}`;
      thumb.ariaValueMax = `${this.#thumbs[i + 1]?.value ?? this.max}`;
      thumb.ariaValueNow = `${value}`;
      // Surface the human-formatted value to assistive tech when `displayWith` is supplied, since the
      // visible label is aria-hidden.
      thumb.ariaValueText = this.displayWith ? this.displayWith(value) : null;
      thumb.ariaOrientation = this.orientation;

      // The thumb is slotted light DOM, so its own stylesheet cannot select on the
      // slider's orientation. A custom state carries it across.
      if (this.#vertical) {
        addCustomState(thumb, "--vertical");
      } else {
        deleteCustomState(thumb, "--vertical");
      }
    });
  }

  /**
   * The number of interior stops: `steps` when set, otherwise derived from `step`. Returns `-1`
   * (disabled/continuous) when there is no usable stepping.
   * @private
   */
  get #stopCount(): number {
    if (this.steps > 0) return Math.trunc(this.steps);
    const step = this.step;
    if (step <= 0) return -1;
    const span = this.max - this.min;
    if (span <= 0) return -1;
    return Math.max(0, Math.round(span / step) - 1);
  }

  /**
   * The evenly-spaced snap anchors (values) across `[min, max]`, matching AndroidX's
   * `stepsToTickFractions`: `stops + 2` values including both endpoints. Empty when continuous.
   * @private
   */
  #anchors(): number[] {
    const stops = this.#stopCount;
    if (stops < 0) return [];
    const count = stops + 2;
    const out = new Array<number>(count);
    for (let i = 0; i < count; i++) out[i] = this.min + ((this.max - this.min) * i) / (stops + 1);
    return out;
  }

  /**
   * Snaps `value` to the nearest anchor. Mirrors AndroidX `snapValueToTick`: ties resolve to the
   * lower anchor (first in iteration survives an equal distance). Continuous when no anchors.
   * @private
   */
  #snapValue(value: number): number {
    const anchors = this.#anchors();
    if (anchors.length === 0) return value;
    let closest = anchors[0];
    let minDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const distance = Math.abs(anchor - value);
      if (distance < minDistance) {
        minDistance = distance;
        closest = anchor;
      }
    }
    return closest;
  }

  /** @private */
  #valueFromPoint(e: PointerEvent): number {
    // The axis end holds `min` for a vertical slider, as it does in rtl.
    const pos =
      this.#vertical || M3eDirectionality.current === "rtl"
        ? this.#cachedClientEnd - (this.#vertical ? e.clientY : e.clientX)
        : e.clientX - this.#cachedClientStart;

    const thumbRatio = this.#cachedSize ? this.#cachedThumbSize / this.#cachedSize : 0;
    const percentage = (pos / this.#cachedClientSize - thumbRatio / 2) / (1 - thumbRatio || 1);
    const clamped = Math.min(1, Math.max(0, percentage));
    const raw = clamped * (this.max - this.min) + this.min;

    // Snap to the nearest anchor (endpoints + interior stops), ties toward the lower anchor.
    const snapped = this.#snapValue(raw);
    return Math.min(this.max, Math.max(this.min, snapped));
  }

  /** @private */
  #updateCachedDimensions(force = false): void {
    if (!this.lowerThumb) return;

    const size = this.#vertical ? this.clientHeight : this.clientWidth;
    const thumbSize = this.#vertical ? this.lowerThumb.clientHeight : this.lowerThumb.clientWidth;

    this.#cachedSize = !force && this.#cachedSize > 0 ? this.#cachedSize : size;
    this.#cachedThumbSize = !force && this.#cachedThumbSize > 0 ? this.#cachedThumbSize : thumbSize;

    const rect = this.getBoundingClientRect();
    const clientStart = this.#vertical ? rect.top : rect.left;
    const clientEnd = this.#vertical ? rect.bottom : rect.right;
    const clientSize = this.#vertical ? rect.height : rect.width;

    this.#cachedClientStart = !force && this.#cachedClientStart > 0 ? this.#cachedClientStart : clientStart;
    this.#cachedClientEnd = !force && this.#cachedClientEnd > 0 ? this.#cachedClientEnd : clientEnd;
    this.#cachedClientSize = !force && this.#cachedClientSize > 0 ? this.#cachedClientSize : clientSize;
  }

  /** @private */
  #updateDimensions(force = false): void {
    this.#updateCachedDimensions(force);
    if (!this.lowerThumb) return;

    const vertical = this.#vertical;
    const rtl = M3eDirectionality.current === "rtl";

    const lowerValue = this.lowerThumb.value ?? this.min;
    const upperValue = this.upperThumb?.value ?? null;
    const isRange = upperValue != null;
    const centered = this.centered && !isRange;
    this._base?.classList.toggle("range", isRange);
    this._base?.classList.toggle("centered", centered);

    // The AndroidX-style `steps` attribute creates discrete stops/ticks; the m3e `step`
    // value-increment only drives pointer snapping (via #snapValue), so a continuous slider is not
    // chopped into a stop per unit.
    const total = this.#cachedSize;
    const along = this.#cachedThumbSize;
    const length = Math.max(0, total - along);

    // Normalised (0..1) value positions; the thumb centre travels across `length` inset by thumb/2.
    const lo = sliderValueFraction(lowerValue, this.min, this.max);
    const hi = isRange ? sliderValueFraction(upperValue!, this.min, this.max) : lo;

    // Work in px along the full slider extent (0..total) so segments and thumb share one coordinate
    // space: the thumb centre for a value sits at `along/2 + fraction*length`.
    const gap = this.#thumbTrackGap;
    const centerGap = this.#centerGap;
    const thumbGap = along / 2 + gap; // centre → segment end when the boundary holds a thumb
    const cg = centerGap / 2; // centre → segment end when the boundary is the centre
    const centerLo = along / 2 + lo * length;
    const centerHi = along / 2 + hi * length;

    let headEnd: number;
    let activeLeft: number;
    let activeRight: number;
    let tailStart: number;
    if (centered) {
      const center = along / 2 + this.#centerFraction * length;
      const segLo = Math.min(centerLo, center);
      const segHi = Math.max(centerLo, center);
      const gLo = centerLo < center ? thumbGap : cg;
      const gHi = centerLo > center ? thumbGap : cg;
      headEnd = segLo - gLo;
      activeLeft = segLo + gLo;
      activeRight = segHi - gHi;
      tailStart = segHi + gHi;
    } else if (isRange) {
      headEnd = centerLo - thumbGap;
      activeLeft = centerLo + thumbGap;
      activeRight = centerHi - thumbGap;
      tailStart = centerHi + thumbGap;
    } else {
      // Plain single slider: active from the start up to the thumb, inactive tail after.
      headEnd = 0;
      activeLeft = 0;
      activeRight = centerLo - thumbGap;
      tailStart = centerLo + thumbGap;
    }

    const pct = (px: number): string => `${total > 0 ? (px / total) * 100 : 0}%`;
    const startW = Math.max(0, headEnd);
    const activeW = Math.max(0, activeRight - activeLeft);
    const endW = Math.max(0, total - tailStart);

    const track = this._track;
    if (track) {
      track.style.setProperty("--_track-h", `${this.#trackHeight}px`);
      track.style.setProperty("--_start-w", pct(startW));
      track.style.setProperty("--_active-l", pct(activeLeft));
      track.style.setProperty("--_active-w", pct(activeW));
      track.style.setProperty("--_end-w", pct(endW));
      track.classList.toggle("centered", centered);
      track.classList.toggle("range", isRange);
    }

    // Thumb placement: top-left along the axis = centre − thumb/2, expressed as a translate.
    const place = (thumb: M3eSliderThumbElement, fraction: number): void => {
      const topLeft = fraction * length;
      thumb.style.transform = vertical
        ? `translate(0, ${topLeft}px)`
        : `translate(${rtl ? -topLeft : topLeft}px, 0)`;
    };
    place(this.lowerThumb, lo);
    if (this.upperThumb && upperValue != null) place(this.upperThumb, hi);

    // Ticks / stops.
    this.#updateTickDots(activeLeft, activeRight, total);
  }

  /** The centre value as a 0..1 fraction (0 within range, else the midpoint). @private */
  get #centerFraction(): number {
    const centerValue = this.min <= 0 && 0 <= this.max ? 0 : (this.min + this.max) / 2;
    return sliderValueFraction(centerValue, this.min, this.max);
  }

  /**
   * Recomputes the visible tick/stop dots. Discrete sliders show a dot at every anchor; the dots on
   * the active segment use the active-tick colour. Ticks that fall under a thumb or in the centre gap
   * are hidden.
   * @private
   */
  #updateTickDots(activeLeftPx: number, activeRightPx: number, total: number): void {
    const ticks = new Array<{ value: number; active: boolean; hidden: boolean }>();
    // Discrete stops come from the AndroidX `steps` attribute, or the legacy `step` increment when it
    // is coarse enough (> 1). A plain step=1 slider is continuous and shows only its endpoints.
    if (this.discrete) {
      let anchors: number[] = [];
      if (this.steps > 0) {
        anchors = this.#anchors();
      } else if (this.step > 1) {
        const stops = Math.max(0, Math.round((this.max - this.min) / this.step) - 1);
        anchors = Array.from({ length: stops + 2 }, (_, i) => this.min + ((this.max - this.min) * i) / (stops + 1));
      }
      if (anchors.length > 0) {
        const along = this.#cachedThumbSize;
        const length = Math.max(0, total - along);
        for (const value of anchors) {
          const f = sliderValueFraction(value, this.min, this.max);
          const px = along / 2 + f * length;
          ticks.push({ value, active: px >= activeLeftPx && px <= activeRightPx, hidden: false });
        }
        this._ticks = ticks;
        return;
      }
    }
    ticks.push({ value: this.min, active: false, hidden: false });
    if (this.min < 0 && this.max > 0) ticks.push({ value: 0, active: false, hidden: false });
    ticks.push({ value: this.max, active: false, hidden: false });
    this._ticks = ticks;
  }

  /** @private */
  #renderTick(tick: { value: number; active: boolean; hidden: boolean }) {
    const f = sliderValueFraction(tick.value, this.min, this.max);
    return html`<span
      class="tick ${tick.active ? "active" : "inactive"}${tick.hidden ? " hidden" : ""}"
      style=${`--_tick-pos:${f * 100}%`}
    ></span>`;
  }

  /** The thumb-track gap in px, AndroidX ThumbTrackGapSize (6dp). @private */
  get #thumbTrackGap(): number {
    const raw = parseFloat(getComputedStyle(this).getPropertyValue("--m3e-slider-thumb-track-gap"));
    return Number.isFinite(raw) ? raw : 6;
  }

  /** The total gap around the centre in a centred slider (px). @private */
  get #centerGap(): number {
    const raw = parseFloat(getComputedStyle(this).getPropertyValue("--m3e-slider-center-gap"));
    return Number.isFinite(raw) ? raw : 6;
  }

  /** The track's cross-axis thickness in px (its rendered height when horizontal, width when vertical). @private */
  get #trackHeight(): number {
    const el = this._track;
    if (!el) return 16;
    const thickness = this.#vertical ? el.clientWidth : el.clientHeight;
    return thickness > 0 ? thickness : 16;
  }

  /** @private */
  #handlePointerDown(e: PointerEvent): void {
    this.#updateCachedDimensions(true);

    if (e.pointerType === "mouse" && e.button > 1) return;
    if (!this.lowerThumb || this.disabled) return;

    if (e.target instanceof HTMLElement) {
      e.target.setPointerCapture(e.pointerId);
    }

    this.#changedThumbs.clear();
    this.#lastThumbMoveTimestamp = e.timeStamp;

    this.#activeThumb = e.composedPath().find((x) => x instanceof M3eSliderThumbElement);

    if (this.#activeThumb) {
      return;
    }

    const value = this.#valueFromPoint(e);
    let min = this.min;
    let max = this.max;

    if (this.#activeThumb === this.upperThumb) {
      min = Math.max(min, this.lowerThumb?.value ?? 0);
    } else if (this.upperThumb) {
      max = Math.min(max, this.upperThumb.value ?? this.max);
    }

    if (!this.upperThumb) {
      if (!this.lowerThumb.disabled) {
        this.#changeThumb(this.lowerThumb, Math.min(max, Math.max(min, value)), true);
        this.#activeThumb = this.lowerThumb;
      }
    } else {
      const lowerValue = this.lowerThumb.value ?? this.min;
      const upperValue = this.upperThumb.value ?? lowerValue;

      if (value < lowerValue) {
        if (!this.lowerThumb.disabled) {
          this.#changeThumb(this.lowerThumb, Math.min(max, Math.max(min, value)), true);
          this.#activeThumb = this.lowerThumb;
        }
      } else if (value > upperValue) {
        if (!this.upperThumb.disabled) {
          this.#changeThumb(this.upperThumb, Math.min(max, Math.max(min, value)), true);
          this.#activeThumb = this.upperThumb;
        }
      } else {
        const mid = (lowerValue + upperValue) / 2;
        if (value < mid && !this.lowerThumb.disabled) {
          this.#changeThumb(this.lowerThumb, Math.min(max, Math.max(min, value)), true);
          this.#activeThumb = this.lowerThumb;
        } else if (!this.upperThumb.disabled) {
          this.#changeThumb(this.upperThumb, Math.min(max, Math.max(min, value)), true);
          this.#activeThumb = this.upperThumb;
        }
      }
    }

    if (this.#activeThumb) {
      addCustomState(this.#activeThumb, "--active");
    }
  }

  /** @private */
  #handlePointerMove(e: PointerEvent): void {
    if (
      !(e.target instanceof HTMLElement) ||
      !e.target.hasPointerCapture(e.pointerId) ||
      !this.#activeThumb ||
      this.#activeThumb.disabled
    ) {
      return;
    }

    let value = this.#valueFromPoint(e);
    let min = this.min;
    let max = this.max;

    if (this.#activeThumb === this.upperThumb) {
      min = Math.max(min, this.lowerThumb?.value ?? 0);
    } else if (this.upperThumb) {
      max = Math.min(max, this.upperThumb.value ?? this.max);
    }

    value = Math.min(max, Math.max(min, value));
    if (value === this.#activeThumb.value) {
      return;
    }

    // Only animate value change when there are discrete stops and drag speed occurs past a
    // tolerance. Tolerance is based on visual impact to transitions during fast drag operations.
    const stops = this.#stopCount;
    let animate = stops > 0;

    if (animate) {
      for (const coalescedEvent of e.getCoalescedEvents()) {
        if (coalescedEvent.timeStamp - this.#lastThumbMoveTimestamp < 90) {
          animate = false;
        }
        this.#lastThumbMoveTimestamp = coalescedEvent.timeStamp;
      }
    }

    if (!animate) {
      if (hasCustomState(this, "--animating")) {
        deleteCustomState(this, "--animating");
        this.#activeThumb.style.transition = "";
      }
    }

    this.#changeThumb(this.#activeThumb, value, animate);
  }

  /** @private */
  #handlePointerUp(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button > 1) return;
    if (!this.lowerThumb || this.disabled) return;

    if (e.target instanceof HTMLElement) {
      e.target.releasePointerCapture(e.pointerId);
    }

    this.#lastThumbMoveTimestamp = 0;

    if (this.#activeThumb && !this.#activeThumb.disabled) {
      this.#commitThumb(this.#activeThumb);
      this.#activeThumb.focus();
      deleteCustomState(this.#activeThumb, "--active");
    }
  }

  /** @private */
  #handleKeyDown(e: KeyboardEvent): void {
    this.#activeThumb = e.composedPath().find((x) => x instanceof M3eSliderThumbElement);

    if (!this.#activeThumb) return;

    const value = this.#activeThumb.value ?? 0;

    let min = this.min;
    let max = this.max;

    if (this.#activeThumb === this.upperThumb) {
      min = Math.max(min, this.lowerThumb?.value ?? 0);
    } else if (this.upperThumb) {
      max = Math.min(max, this.upperThumb.value ?? this.max);
    }

    // A vertical slider runs bottom-to-top, so ArrowUp always increases and
    // directionality — an inline-axis concern — does not apply.
    const ascending = this.#vertical || M3eDirectionality.current === "ltr";

    // Step between adjacent anchors (covers both `steps` and `step`). Falls back to a tenth of the
    // range for a continuous slider so arrow keys still move.
    const anchors = this.#anchors();
    const span = this.max - this.min;
    const anchorStep = anchors.length > 1 ? anchors[1] - anchors[0] : span > 0 ? span / 10 : 1;
    const pageStep = anchors.length > 1 ? Math.max(anchorStep, anchorStep * 10) : anchorStep;

    /** Moves one anchor in the given direction, snapping to the anchor grid. @private */
    const stepBy = (direction: 1 | -1) => this.#snapValue(value + direction * anchorStep);
    const pageBy = (direction: 1 | -1) => this.#snapValue(value + direction * pageStep);

    switch (e.key) {
      case "Home":
        this.#changeThumb(this.#activeThumb, min);
        e.preventDefault();
        break;

      case "End":
        this.#changeThumb(this.#activeThumb, max);
        e.preventDefault();
        break;

      case "PageUp":
        this.#changeThumb(this.#activeThumb, Math.min(max, Math.max(min, ascending ? pageBy(1) : pageBy(-1))));
        e.preventDefault();
        break;

      case "PageDown":
        this.#changeThumb(this.#activeThumb, Math.min(max, Math.max(min, ascending ? pageBy(-1) : pageBy(1))));
        e.preventDefault();
        break;

      case "Down":
      case "ArrowDown":
      case "Left":
      case "ArrowLeft":
        this.#changeThumb(this.#activeThumb, Math.min(max, Math.max(min, ascending ? stepBy(-1) : stepBy(1))));
        e.preventDefault();
        break;

      case "Up":
      case "ArrowUp":
      case "Right":
      case "ArrowRight":
        this.#changeThumb(this.#activeThumb, Math.min(max, Math.max(min, ascending ? stepBy(1) : stepBy(-1))));
        e.preventDefault();
        break;

      case " ":
        e.preventDefault();
        break;
    }
  }

  /** @private */
  #handleKeyUp(e: KeyboardEvent): void {
    const activeThumb = e.composedPath().find((x) => x instanceof M3eSliderThumbElement);
    if (activeThumb) {
      this.#commitThumb(activeThumb);
    }
  }

  /** @private */
  #handleThumbChange(e: Event): void {
    e.stopPropagation();
    this.#updateThumbs();
    this.#updateDimensions();
  }

  /** @private */
  #changeThumb(thumb: M3eSliderThumbElement, value: number, animate = false): void {
    if (thumb.value === value) return;

    if (thumb.dispatchEvent(new Event("beforeinput", { bubbles: true, cancelable: true }))) {
      if (animate && !prefersReducedMotion()) {
        addCustomState(this, "--animating");
        thumb.addEventListener(
          "transitionend",
          () => {
            thumb.style.transition = "";
            deleteCustomState(this, "--animating");
          },
          { once: true },
        );
        thumb.style.transition = `transform ${DesignToken.motion.spring.fastEffects}`;
      }
      this.#changedThumbs.add(thumb);
      thumb.value = value;
      thumb.markAsDirty();
      thumb.markAsTouched();
      thumb.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /** @private */
  #commitThumb(thumb: M3eSliderThumbElement): void {
    if (this.#changedThumbs.has(thumb)) {
      thumb.dispatchEvent(new Event("change", { bubbles: true }));
      this.#changedThumbs.delete(thumb);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-slider": M3eSliderElement;
  }
}
