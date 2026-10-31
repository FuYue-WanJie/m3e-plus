import { css, CSSResultGroup, LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { PressedController } from "../controllers";
import { HtmlFor, Role } from "../mixins";
import { customElement } from "../decorators";

import { RippleToken } from "./RippleToken";

/** Per-ripple animation bookkeeping (androidx `RippleAnimation`). */
interface RippleEntry {
  radiusAndCenter: Animation;
  alpha: Animation;
  persistent: boolean;
  finishing: boolean;
}

/** A ripple circle element carrying its animation entry. */
type RippleDivElement = HTMLElement & { _entry?: RippleEntry };

/**
 * Connects user input to screen reactions using ripples.
 *
 * @description
 * The `m3e-ripple` component is an absolute positioned element used to depict a ripple.
 * The parenting element must be a relative positioned element.
 *
 * The component can be attached to an interactive element using the `for` attribute or programmatically using the `attach` method.
 * The ripple is displayed when the interactive element is pressed and hidden when released.  This can be disabled using the `disabled` attribute.
 *
 * The pressed state actives either using both pointer and keyboard events. For keyboard events, `SPACE` activate a ripple.
 *
 * Alternatively, you can use the `show` and `hide` methods to programmatically control the ripple.
 *
 * @example
 * The following example illustrates attaching a ripple to an interactive element. In this example, the parenting div
 * has relative positioning and is given an `id` referenced by `m3e-ripple` using the `for` attribute.  Note that `#myDiv`
 * is not used when specifying the attached element's identifier.  The `#` is inferred.
 *
 * ```html
 * <div id="myDiv" tabindex="0" style="position: relative;">
 *  <m3e-ripple for="myDiv"></m3e-ripple>
 * <div>
 * ```
 *
 * @tag m3e-ripple
 *
 * @attr centered - Whether the ripple always originates from the center of the element's bounds, rather than originating from the location of the click event.
 * @attr disabled - Whether click events will not trigger the ripple.  Ripples can be still controlled manually by using the `show` and 'hide' methods.
 * @attr for - The identifier of the interactive control to which this element is attached.
 * @attr radius - The radius, in pixels, of the ripple.
 * @attr unbounded - Whether the ripple is visible outside the element's bounds.
 *
 * @cssprop --m3e-ripple-color - The color of the ripple.
 * @cssprop --m3e-ripple-enter-duration - The duration for the enter animation (expansion from point of contact).
 * @cssprop --m3e-ripple-exit-duration - The duration for the exit animation (fade-out).
 * @cssprop --m3e-ripple-opacity - The opacity of the ripple.
 */
@customElement("m3e-ripple")
export class M3eRippleElement extends HtmlFor(Role(LitElement, "none")) {
  /** The styles of the element. */
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      border-radius: inherit;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:not([unbounded])) {
      overflow: hidden;
    }
    :host(:not([unbounded])) .ripple {
      contain: layout style paint;
    }
    :host([unbounded]) .ripple {
      contain: layout style;
    }
    .ripple {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      border-radius: 50%;
      background-color: ${RippleToken.color};
      opacity: 0;
      will-change: transform, opacity;
    }
    @media (prefers-reduced-motion) {
      .ripple {
        animation-duration: 1ms !important;
      }
    }
    @media (forced-colors: active) {
      .ripple {
        display: none;
      }
    }
  `;

  /** @private */ readonly #ripples: Set<HTMLElement> = new Set();
  /** @private */ readonly #pressedController = new PressedController(this, {
    target: null,
    minPressedDuration: 0,
    isPressedKey: (key) => key === " ",
    callback: (pressed, { x, y }) => this.#handlePressedChange(pressed, x, y),
  });

  /**
   * Whether click events will not trigger the ripple.
   * Ripples can be still controlled manually by using the `show` and 'hide' methods.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * Whether the ripple always originates from the center of the element's bounds, rather
   * than originating from the location of the click event.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) centered = false;

  /**
   * Whether the ripple is visible outside the element's bounds.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) unbounded = false;

  /**
   * The radius, in pixels, of the ripple.
   * @default null
   */
  @property({ type: Number }) radius: number | null = null;

  /** Whether the ripple is currently visible to the user. */
  get visible() {
    return this.#ripples.size > 0;
  }

  /**
   * Launches a manual ripple.
   * @param {number} x The x-coordinate, relative to the viewport, at which to present the ripple.
   * @param {number} y The y-coordinate, relative to the viewport, at which to present the ripple.
   * @param {boolean} [persistent=false] Whether the ripple will persist until hidden.
   */
  show(x: number, y: number, persistent: boolean = false): void {
    const bounds = this.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    if (this.centered) {
      x = centerX;
      y = centerY;
    }

    // AndroidX `RippleAnimation`: the radius starts at 30% of the largest dimension (60% of the
    // diameter) and ends covering the bounds — 10dp extra beyond the corner for bounded ripples.
    const maxDimension = Math.max(bounds.width, bounds.height);
    const startRadius = maxDimension * 0.3;
    const endRadius =
      this.radius && !isNaN(this.radius)
        ? this.radius
        : this.unbounded
          ? Math.hypot(bounds.width, bounds.height) / 2
          : Math.hypot(bounds.width, bounds.height) / 2 + 10;

    const ripple = document.createElement("div");
    ripple.classList.add("ripple");
    const diameter = endRadius * 2;
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;

    if (!this.shadowRoot) return;
    this.#ripples.add(ripple);
    this.shadowRoot.appendChild(ripple);

    // Three parallel tracks (androidx `RippleAnimation.animate`): alpha fades in over 75ms while
    // the radius (FastOutSlowIn) and the center (clamped to the bounds, Linear) run over 225ms.
    // The center is a translate from the touch point to the middle of the element for bounded
    // ripples; unbounded ripples stay centered on the touch point.
    const moveX = this.unbounded ? x - bounds.left : x - centerX;
    const moveY = this.unbounded ? y - bounds.top : y - centerY;
    const scaleFrom = startRadius / endRadius;
    const { fadeInDuration, radiusDuration } = this.#durations();

    const radiusAndCenter = ripple.animate(
      [
        { transform: `translate(${moveX - endRadius}px, ${moveY - endRadius}px) scale(${scaleFrom})` },
        { transform: `translate(${-endRadius}px, ${-endRadius}px) scale(1)` },
      ],
      { duration: radiusDuration, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    const rippleAlpha = (() => {
      const raw = parseFloat(getComputedStyle(this).getPropertyValue("--m3e-ripple-opacity"));
      return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.1;
    })();
    const alpha = ripple.animate([{ opacity: 0 }, { opacity: rippleAlpha }], {
      duration: fadeInDuration,
      easing: "linear",
      fill: "forwards",
    });

    const entry: RippleEntry = { radiusAndCenter, alpha, persistent, finishing: false };
    (ripple as RippleDivElement & { _entry?: RippleEntry })._entry = entry;

    alpha.addEventListener("finish", () => {
      if (!entry.persistent && !entry.finishing) this.#exitRipple(ripple);
    });
    if (!persistent) {
      // A non-persistent ripple exits after the enter animation; persistent ones wait for hide().
      radiusAndCenter.addEventListener("finish", () => {
        if (!entry.persistent && !entry.finishing) this.#exitRipple(ripple);
      });
    }
  }

  /**
   * Resolves the three durations (ms) from the CSS custom properties on the host. The token
   * strings are CSS values (possibly var() chains), so they must go through the style engine.
   * @private
   */
  #durations(): { fadeInDuration: number; radiusDuration: number; fadeOutDuration: number } {
    const style = getComputedStyle(this);
    const parse = (value: string, fallback: number): number => {
      const ms = parseFloat(value);
      return Number.isFinite(ms) && ms >= 0 ? ms : fallback;
    };
    return {
      fadeInDuration: parse(style.getPropertyValue("--m3e-ripple-fade-in-duration"), 75),
      radiusDuration: parse(style.getPropertyValue("--m3e-ripple-radius-duration"), 225),
      fadeOutDuration: parse(style.getPropertyValue("--m3e-ripple-fade-out-duration"), 150),
    };
  }

  /** Manually hides the ripple. */
  hide(): void {
    for (const ripple of this.#ripples) {
      this.#exitRipple(ripple);
    }
  }

  /**
   * Fades a ripple out (androidx `RippleAnimation.fadeOut`, 150ms linear) and removes it. If the
   * fade-in had not finished yet, the alpha jumps straight to full first (androidx `draw`).
   * @private
   */
  #exitRipple(ripple: HTMLElement): void {
    const entry = (ripple as RippleDivElement)._entry;
    if (!entry || entry.finishing) return;
    entry.finishing = true;
    const exitDuration = this.#durations().fadeOutDuration;
    entry.radiusAndCenter.finish();
    const current = parseFloat(getComputedStyle(ripple).opacity) || 0;
    ripple
      .animate([{ opacity: current }, { opacity: 0 }], { duration: exitDuration, easing: "linear", fill: "forwards" })
      .addEventListener("finish", () => {
        ripple.remove();
        this.#ripples.delete(ripple);
      });
  }

  /** @inheritdoc */
  override attach(control: HTMLElement): void {
    super.attach(control);
    this.#pressedController.observe(control);
  }

  /** @inheritdoc */
  override detach(): void {
    if (this.control) {
      this.#pressedController.unobserve(this.control);
    }
    super.detach();
  }

  /** @inheritdoc */
  override connectedCallback(): void {
    this.ariaHidden = "true";
    super.connectedCallback();
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#destroyRipple();
  }

  /** @inheritdoc */
  protected override updated(_changedProperties: PropertyValues<this>): void {
    super.updated(_changedProperties);

    if (_changedProperties.has("disabled") && this.disabled) {
      this.hide();
    }
  }

  /** @private */
  #destroyRipple(ripple?: HTMLElement): void {
    if (ripple) {
      const entry = (ripple as RippleDivElement)._entry;
      entry?.radiusAndCenter.cancel();
      entry?.alpha.cancel();
      ripple.remove();
      this.#ripples.delete(ripple);
    } else {
      for (const r of this.#ripples) {
        this.#destroyRipple(r);
      }
      this.#ripples.clear();
    }
  }

  /** @private */
  #handlePressedChange(pressed: boolean, x: number, y: number): void {
    if (!this.disabled) {
      if (pressed) {
        this.show(x, y, true);
      } else {
        this.hide();
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-ripple": M3eRippleElement;
  }
}
