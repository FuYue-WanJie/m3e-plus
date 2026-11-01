import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

/**
 * A Wear OS Material 3 stepper — a full-screen control with an increase button on the top, a
 * decrease button on the bottom and a value slot in the middle. Ported from AndroidX Wear
 * `Stepper.kt`.
 *
 * The step size is `(max - min) / (steps + 1)`; buttons repeat while held
 * (`repeatableClickable`). Button shapes morph from a full pill to `shapes.small` when pressed.
 *
 * @tag m3e-wear-stepper
 *
 * @attr value - The current value (coerced to the closest step for display).
 * @attr min - The minimum value. @default 0
 * @attr max - The maximum value. @default steps + 1
 * @attr steps - Number of discrete values between min and max. @default 0
 * @attr disabled - Disables both buttons.
 *
 * @slot - The content between the buttons (typically the current value).
 * @slot increase - The icon of the increase (top) button.
 * @slot decrease - The icon of the decrease (bottom) button.
 *
 * @fires value-change - Dispatched when the value changes (bubbles).
 *
 * @cssprop --m3e-wear-stepper-button-width - Width of the +/- buttons (default 60px).
 * @cssprop --m3e-wear-stepper-button-height - Height of the +/- buttons (default 48px).
 * @cssprop --m3e-wear-stepper-button-container-color - Button container color.
 * @cssprop --m3e-wear-stepper-button-icon-color - Button icon color.
 * @cssprop --m3e-wear-stepper-button-disabled-container-color - Disabled container color.
 * @cssprop --m3e-wear-stepper-button-disabled-icon-color - Disabled icon color.
 */
@customElement("m3e-wear-stepper")
export class M3eWearStepperElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px; /* VerticalSpacing */
      box-sizing: border-box;
      /* AndroidX StepperImpl is fillMaxSize: fill the screen content area when the parent
         offers it (m3e-wear-screen .content is a flex column), else fall back to 100%. */
      flex: 1 1 auto;
      align-self: stretch;
      width: 100%;
      height: 100%;
      color: var(--m3e-wear-stepper-content-color, var(--m3e-color-on-surface, #1d1b20));
    }
    :host([hidden]) {
      display: none;
    }
    /* AndroidX verticalContentPadding = 5.2% of the screen width (Stepper.kt). The host is a
       size container, so 5.2cqw tracks the screen it fills. */
    :host {
      --_vpad: var(--m3e-wear-stepper-vertical-padding, 5.2cqw);
      container-type: size;
      container-name: stepper;
    }
    .button-area {
      flex: 0 0 35%; /* ButtonWeight */
      display: flex;
      justify-content: center;
      box-sizing: border-box;
    }
    .button-area.increase {
      align-items: flex-start;
      padding-top: var(--_vpad);
    }
    .button-area.decrease {
      align-items: flex-end;
      padding-bottom: var(--_vpad);
    }
    .content-area {
      flex: 1 1 30%; /* ContentWeight */
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    /* Gap eats into the 30%/35% weights on short hosts; collapse it when space is tight. */
    @container stepper (max-height: 179px) {
      :host {
        gap: 0;
      }
    }
    button {
      appearance: none;
      border: none;
      margin: 0;
      padding: 0;
      width: var(--m3e-wear-stepper-button-width, 60px);
      height: var(--m3e-wear-stepper-button-height, 48px);
      border-radius: 9999px; /* StepperButtonShape = CornerFull */
      background-color: var(
        --m3e-wear-stepper-button-container-color,
        var(--m3e-color-primary-container, #eaddff)
      );
      color: var(--m3e-wear-stepper-button-icon-color, var(--m3e-color-primary, #6750a4));
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      /* Shape morph pill -> shapes.small (8px) on press (animateButtonShape); spring-like overshoot. */
      transition: border-radius 250ms cubic-bezier(0.34, 1.4, 0.64, 1);
      touch-action: manipulation;
      position: relative;
      overflow: hidden;
    }
    /* State layer: hover 8%, pressed/focus 10% of the icon color. */
    button::before {
      content: "";
      position: absolute;
      inset: 0;
      background: currentColor;
      opacity: 0;
      transition: opacity 150ms;
      pointer-events: none;
    }
    button:not(:disabled):hover::before {
      opacity: 0.08;
    }
    button:focus-visible::before,
    button.pressed::before {
      opacity: 0.1;
    }
    /* .pressed is held for a minimum time so a quick tap still shows the morph. */
    button.pressed {
      border-radius: 8px; /* StepperButtonPressedShape = shapes.small */
    }
    button:disabled {
      /* OnSurface at 12% container / 38% icon (toDisabledColor), not the whole button faded. */
      background-color: var(
        --m3e-wear-stepper-button-disabled-container-color,
        color-mix(in srgb, var(--m3e-wear-color-on-surface, #e6e0e9) 12%, transparent)
      );
      color: var(
        --m3e-wear-stepper-button-disabled-icon-color,
        color-mix(in srgb, var(--m3e-wear-color-on-surface, #e6e0e9) 38%, transparent)
      );
      cursor: default;
    }
    button:focus-visible {
      outline: 2px solid var(--m3e-color-primary, #6750a4);
      outline-offset: 2px;
    }
    ::slotted(*) {
      display: block;
    }
    .icon-slot::slotted(*) {
      width: 24px; /* StepperDefaults.IconSize */
      height: 24px;
    }
    @media (prefers-reduced-motion) {
      button {
        transition: none;
      }
    }
  `;

  /** The current value. @default 0 */
  @property({ type: Number }) value = 0;

  /** The minimum value. @default 0 */
  @property({ type: Number }) min = 0;

  /** The maximum value. Defaults to `steps + 1` when unset. @default null */
  @property({ type: Number }) max: number | null = null;

  /** Number of discrete values between min and max. @default 0 */
  @property({ type: Number }) steps = 0;

  /** Whether the stepper is disabled. @default false */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** @private */ @state() private _currentStep = 0;
  /** @private */ #repeatTimer: number | ReturnType<typeof setInterval> | null = null;
  /** @private */ #initialDelayTimer: number | ReturnType<typeof setTimeout> | null = null;

  /** @private */ get #effectiveMax(): number {
    return this.max ?? this.steps + 1;
  }

  /** @inheritdoc */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has("value") ||
      changed.has("min") ||
      changed.has("max") ||
      changed.has("steps")
    ) {
      // RangeDefaults.snapValueToStep: coerce value to the closest of steps+2 anchor values.
      const span = this.#effectiveMax - this.min;
      const stepSize = this.steps >= 0 && span > 0 ? span / (this.steps + 1) : 0;
      const clamped = Math.min(this.#effectiveMax, Math.max(this.min, this.value));
      this._currentStep =
        stepSize > 0 ? Math.round((clamped - this.min) / stepSize) : 0;
    }
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#release();
  }

  /** RangeDefaults.calculateCurrentStepValue. @private */
  #stepValue(step: number): number {
    const span = this.#effectiveMax - this.min;
    const stepSize = span / (this.steps + 1);
    const clamped = Math.min(this.steps + 1, Math.max(0, step));
    return this.min + clamped * stepSize;
  }

  /** @private */
  #updateValue(stepDiff: number): void {
    const newValue = this.#stepValue(this._currentStep + stepDiff);
    if (newValue !== this.value) {
      this.value = newValue;
      this.dispatchEvent(new Event("value-change", { bubbles: true }));
    }
  }

  /** @private */ #pressedButton: HTMLElement | null = null;
  /** @private */ #pressedAt = 0;

  /** Press: morph + start repeating; release is listened on window (a button that turns disabled
   *  at the limit stops receiving pointer events). @private */
  #press(e: PointerEvent, stepDiff: number): void {
    if (e.button !== 0) return;
    this.#release();
    const btn = e.currentTarget as HTMLElement;
    btn.classList.add("pressed");
    this.#pressedButton = btn;
    this.#pressedAt = performance.now();
    window.addEventListener("pointerup", this.#release);
    window.addEventListener("pointercancel", this.#release);
    this.#startRepeat(stepDiff);
  }

  /** @private */
  #release = (): void => {
    this.#stopRepeat();
    window.removeEventListener("pointerup", this.#release);
    window.removeEventListener("pointercancel", this.#release);
    const btn = this.#pressedButton;
    if (!btn) return;
    this.#pressedButton = null;
    // Hold the pressed shape at least 150ms so a quick tap still visibly morphs.
    const wait = Math.max(0, 150 - (performance.now() - this.#pressedAt));
    setTimeout(() => btn.classList.remove("pressed"), wait);
  };

  /** repeatableClickable: fire immediately, then repeat every 200ms after a 400ms delay. @private */
  #startRepeat(stepDiff: number): void {
    this.#stopRepeat();
    this.#updateValue(stepDiff);
    this.#initialDelayTimer = setTimeout(() => {
      this.#repeatTimer = setInterval(() => this.#updateValue(stepDiff), 200);
    }, 400);
  }

  /** @private */
  #stopRepeat(): void {
    if (this.#initialDelayTimer !== null) {
      clearTimeout(this.#initialDelayTimer);
      this.#initialDelayTimer = null;
    }
    if (this.#repeatTimer !== null) {
      clearInterval(this.#repeatTimer as ReturnType<typeof setInterval>);
      this.#repeatTimer = null;
    }
  }

  protected override render(): unknown {
    const increaseEnabled = !this.disabled && this._currentStep < this.steps + 1;
    const decreaseEnabled = !this.disabled && this._currentStep > 0;
    return html`
      <div class="button-area increase">
        <button
          part="increase-button"
          aria-label="Increase"
          ?disabled=${!increaseEnabled}
          @pointerdown=${(e: PointerEvent) => increaseEnabled && this.#press(e, 1)}
          @click=${(e: MouseEvent) => increaseEnabled && e.detail === 0 && this.#updateValue(1)}
          @pointerleave=${() => this.#release()}
        >
          <slot name="increase" class="icon-slot">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill="currentColor" />
            </svg>
          </slot>
        </button>
      </div>
      <div class="content-area"><slot></slot></div>
      <div class="button-area decrease">
        <button
          part="decrease-button"
          aria-label="Decrease"
          ?disabled=${!decreaseEnabled}
          @pointerdown=${(e: PointerEvent) => decreaseEnabled && this.#press(e, -1)}
          @click=${(e: MouseEvent) => decreaseEnabled && e.detail === 0 && this.#updateValue(-1)}
          @pointerleave=${() => this.#release()}
        >
          <slot name="decrease" class="icon-slot">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M5 11h14v2H5z" fill="currentColor" />
            </svg>
          </slot>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-wear-stepper": M3eWearStepperElement;
  }
}
