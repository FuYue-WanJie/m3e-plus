import { unsafeCSS } from "lit";

import { DesignToken } from "../tokens";

/**
 * Component design tokens that control the `M3eStateLayerElement`.
 *
 * Opacities and transition durations follow the AndroidX material3-ripple state layers
 * (`Ripple.kt` + `StateTokens.kt`): hover .08 in/out 15ms, focus .10 45ms in / 15ms out,
 * press .10 (handled by the ripple wave), drag .16 45ms in / 150ms out.
 * @internal
 */
export const StateLayerToken = {
  hoverColor: unsafeCSS(`var(--m3e-state-layer-hover-color, ${DesignToken.color.onSurface})`),
  hoverOpacity: unsafeCSS(`var(--m3e-state-layer-hover-opacity, ${DesignToken.state.hoverStateLayerOpacity})`),
  hoverEnterDuration: unsafeCSS(`var(--m3e-state-layer-hover-enter-duration, 15ms)`),
  hoverExitDuration: unsafeCSS(`var(--m3e-state-layer-hover-exit-duration, 15ms)`),
  focusColor: unsafeCSS(`var(--m3e-state-layer-focus-color, ${DesignToken.color.onSurface})`),
  focusOpacity: unsafeCSS(`var(--m3e-state-layer-focus-opacity, ${DesignToken.state.focusStateLayerOpacity})`),
  focusEnterDuration: unsafeCSS(`var(--m3e-state-layer-focus-enter-duration, 45ms)`),
  focusExitDuration: unsafeCSS(`var(--m3e-state-layer-focus-exit-duration, 15ms)`),
  pressedColor: unsafeCSS(`var(--m3e-state-layer-pressed-color, ${DesignToken.color.onSurface})`),
  pressedOpacity: unsafeCSS(`var(--m3e-state-layer-pressed-opacity, ${DesignToken.state.pressedStateLayerOpacity})`),
  pressedEnterDuration: unsafeCSS(`var(--m3e-state-layer-pressed-enter-duration, 15ms)`),
  pressedExitDuration: unsafeCSS(`var(--m3e-state-layer-pressed-exit-duration, 45ms)`),
  draggedColor: unsafeCSS(`var(--m3e-state-layer-dragged-color, ${DesignToken.color.onSurface})`),
  draggedOpacity: unsafeCSS(`var(--m3e-state-layer-dragged-opacity, 16%)`),
  draggedEnterDuration: unsafeCSS(`var(--m3e-state-layer-dragged-enter-duration, 45ms)`),
  draggedExitDuration: unsafeCSS(`var(--m3e-state-layer-dragged-exit-duration, 150ms)`),
  easing: unsafeCSS(`var(--m3e-state-layer-easing, ${DesignToken.motion.easing.standard})`),
} as const;