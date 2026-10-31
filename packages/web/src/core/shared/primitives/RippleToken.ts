import { unsafeCSS } from "lit";

import { DesignToken } from "../tokens";

/**
 * Component design tokens that control the `M3eRippleElement`.
 *
 * Durations follow the AndroidX `material3-ripple` defaults: the alpha fades in over 75ms while
 * the radius expands over 225ms (FastOutSlowIn), and everything fades out over 150ms.
 * @internal
 */
export const RippleToken = {
  color: unsafeCSS(`var(--m3e-ripple-color, ${DesignToken.color.onSurface})`),
  opacity: unsafeCSS(`var(--m3e-ripple-opacity, ${DesignToken.state.pressedStateLayerOpacity})`),
  fadeInDuration: unsafeCSS(`var(--m3e-ripple-fade-in-duration, var(--m3e-ripple-enter-duration, 75ms))`),
  radiusDuration: unsafeCSS(`var(--m3e-ripple-radius-duration, var(--m3e-ripple-enter-duration, 225ms))`),
  fadeOutDuration: unsafeCSS(`var(--m3e-ripple-fade-out-duration, var(--m3e-ripple-exit-duration, 150ms))`),
} as const;
