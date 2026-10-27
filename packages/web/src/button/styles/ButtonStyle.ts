import { css, CSSResultGroup, unsafeCSS } from "lit";

import { DesignToken } from "@wanjie/m3e-web/core";

/**
 * Baseline styles for `M3eButtonElement`.
 * @internal
 */
export const ButtonStyle: CSSResultGroup = css`
  :host {
    /* No double-tap-to-zoom delay or zoom flash on mobile when tapping quickly. */
    touch-action: manipulation;
    display: inline-block;
    outline: none;
    user-select: none;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  }
  :host([hidden]) {
    display: none;
  }
  .base {
    box-sizing: border-box;
    vertical-align: middle;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 100%;
    /* Shape morph is driven by the SpringSimulation engine (M3eButtonElement#syncShape): each frame
       writes the four logical corner radii inline on .base. No CSS transition on border-radius here. */
    transition: ${unsafeCSS(
      `background-color ${DesignToken.motion.duration.short4} ${DesignToken.motion.easing.standard}`,
    )};
  }
  .wrapper {
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .touch {
    position: absolute;
    height: 48px;
    left: 0;
    right: 0;
  }
  :host(:is(:state(--pressed), :--pressed)) .base,
  :host(:is(:state(--resting), :--resting)) .base {
    /* Shape morph follows the JS physics engine (inline per-corner radii); only the background
       color keeps a CSS transition for the variant color change. */
    transition: ${unsafeCSS(`background-color ${DesignToken.motion.duration.short4} ${DesignToken.motion.easing.standard}`)};
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: ${unsafeCSS(`color ${DesignToken.motion.duration.short4} ${DesignToken.motion.easing.standard}`)};
  }
  .icon {
    transition: ${unsafeCSS(`color ${DesignToken.motion.duration.short4} ${DesignToken.motion.easing.standard}`)};
  }
  :host(:not(:disabled):not([disabled-interactive])) {
    cursor: pointer;
  }
  :host([disabled-interactive]) {
    cursor: not-allowed;
  }
  ::slotted([slot="icon"]),
  ::slotted([slot="selected-icon"]),
  ::slotted([slot="trailing-icon"]) {
    font-size: inherit !important;
    flex: none;
  }
  ::slotted(svg[slot="icon"]),
  ::slotted(svg[slot="selected-icon"]),
  ::slotted(svg[slot="trailing-icon"]) {
    width: 1em;
    height: 1em;
  }
  :host([toggle]:not([selected])) .base.with-selected-icon slot[name="selected-icon"],
  :host([toggle][selected]) .base.with-selected-icon slot[name="icon"] {
    display: none;
  }
  a {
    all: unset;
    display: block;
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    bottom: 0px;
    z-index: 1;
  }
  :host(:is(:state(--grouped), :--grouped):is(:state(--connected), :--connected)) {
    flex: 1 1 auto;
  }
  :host(:is(:state(--grouped), :--grouped):not(:is(:state(--connected), :--connected))) {
    /* Width while pressing is owned by M3eButtonGroupElement (inline width + --_adjacent-shrink). */
    flex-shrink: 0;
    flex-grow: 0;
  }
  @media (forced-colors: active) {
    .base,
    .label,
    .icon {
      transition: none;
    }
    :host(:is(:state(--pressed), :--pressed)) .base,
    :host(:is(:state(--resting), :--resting)) .base {
      transition: none;
    }
    :host(:not(:disabled):not([disabled-interactive]):not([toggle])) .base {
      background-color: ButtonFace !important;
      outline-color: ButtonText !important;
    }
    :host(:not(:disabled):not([disabled-interactive]):not([toggle])) .label,
    :host(:not(:disabled):not([disabled-interactive]):not([toggle])) .icon {
      color: ButtonText !important;
    }
    :host(:not(:disabled):not([disabled-interactive])[toggle]:not([selected])) .base {
      background-color: ButtonFace !important;
      outline-color: ButtonText !important;
    }
    :host(:not(:disabled):not([disabled-interactive])[toggle]:not([selected])) .label,
    :host(:hover:not(:disabled):not([disabled-interactive])[toggle]:not([selected])) .label,
    :host(:not(:disabled):not([disabled-interactive])[toggle]:not([selected]):focus) .label,
    :host(:not(:disabled):not([disabled-interactive])[toggle]:not([selected])) .icon,
    :host(:hover:not(:disabled):not([disabled-interactive])[toggle]:not([selected])) .icon,
    :host(:not(:disabled):not([disabled-interactive])[toggle]:not([selected]):focus) .icon {
      color: ButtonText !important;
    }
    :host(:not(:disabled):not([disabled-interactive])[toggle][selected]) .base {
      background-color: ButtonText !important;
      outline: none !important;
    }
    :host(:not(:disabled):not([disabled-interactive])[toggle][selected]) .label,
    :host(:hover:not(:disabled):not([disabled-interactive])[toggle][selected]) .label,
    :host(:not(:disabled):not([disabled-interactive])[toggle][selected]:focus) .label,
    :host(:not(:disabled):not([disabled-interactive])[toggle][selected]) .icon,
    :host(:hover:not(:disabled):not([disabled-interactive])[toggle][selected]) .icon,
    :host(:not(:disabled):not([disabled-interactive])[toggle][selected]:focus) .icon {
      forced-color-adjust: none;
      color: ButtonFace !important;
      background-color: ButtonText !important;
    }
    :host(:disabled) .base,
    :host([disabled-interactive]) .base {
      outline-color: GrayText !important;
      background-color: unset !important;
    }
    :host(:disabled) .label,
    :host([disabled-interactive]) .label,
    :host(:disabled) .icon,
    :host([disabled-interactive]) .icon {
      color: GrayText !important;
    }
    .base {
      outline-style: solid;
    }
    :host(:is(:state(--extra-small), :--extra-small)) .base {
      outline-offset: calc(0px - var(--m3e-button-extra-small-outline-thickness, 1px));
      outline-width: var(--m3e-button-extra-small-outline-thickness, 1px);
    }
    :host(:is(:state(--small), :--small)) .base {
      outline-offset: calc(0px - var(--m3e-button-small-outline-thickness, 1px));
      outline-width: var(--m3e-button-small-outline-thickness, 1px);
    }
    :host(:is(:state(--medium), :--medium)) .base {
      outline-offset: calc(0px - var(--m3e-button-medium-outline-thickness, 1px));
      outline-width: var(--m3e-button-medium-outline-thickness, 1px);
    }
    :host(:is(:state(--large), :--large)) .base {
      outline-offset: calc(0px - var(--m3e-button-large-outline-thickness, 2px));
      outline-width: var(--m3e-button-large-outline-thickness, 2px);
    }
    :host(:is(:state(--extra-large), :--extra-large)) .base {
      outline-offset: calc(0px - var(--m3e-button-extra-large-outline-thickness, 3px));
      outline-width: var(--m3e-button-extra-large-outline-thickness, 3px);
    }
  }
  @media (prefers-reduced-motion) {
    :host(:is(:state(--grouped), :--grouped):not(:is(:state(--connected), :--connected))),
    :host(:is(:state(--grouped), :--grouped):not(:is(:state(--connected), :--connected))) .wrapper,
    :host(:is(:state(--pressed), :--pressed)) .base,
    :host(:is(:state(--resting), :--resting)) .base,
    .base,
    .label,
    .icon {
      transition: none;
    }
  }
`;
