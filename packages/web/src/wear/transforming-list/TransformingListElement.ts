import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { customElement } from "@wanjie/m3e-web/core";

/** One `TransformationVariableSpec` (only the fields the default specs use). */
interface VariableSpec {
  topValue: number;
  bottomValue: number;
  enter: number;
  exit: number;
}

/** `ResponsiveTransformationSpecImpl`. */
interface ResponsiveSpec {
  screenSize: number;
  minElementHeightFraction: number;
  maxElementHeightFraction: number;
  minTransitionAreaHeightFraction: number;
  maxTransitionAreaHeightFraction: number;
  containerAlpha: VariableSpec;
  contentAlpha: VariableSpec;
  scale: VariableSpec;
}

const v = (top: number): VariableSpec => ({ topValue: top, bottomValue: top, enter: 0, exit: 1 });

/** `ResponsiveTransformationSpec.smallScreen()` / `largeScreen()` defaults. */
const SMALL: ResponsiveSpec = {
  screenSize: 192,
  minElementHeightFraction: 0.2,
  maxElementHeightFraction: 0.6,
  minTransitionAreaHeightFraction: 0.35,
  maxTransitionAreaHeightFraction: 0.55,
  containerAlpha: v(0.5),
  contentAlpha: v(0.5),
  scale: v(0.7),
};
const LARGE: ResponsiveSpec = {
  screenSize: 240,
  minElementHeightFraction: 0.15,
  maxElementHeightFraction: 0.45,
  minTransitionAreaHeightFraction: 0.4,
  maxTransitionAreaHeightFraction: 0.6,
  containerAlpha: v(0.5),
  contentAlpha: v(0.5),
  scale: v(0.6),
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const inverseLerp = (a: number, b: number, x: number): number =>
  Math.min(1, Math.max(0, a === b ? 0 : (x - a) / (b - a)));
const lerpVar = (a: VariableSpec, b: VariableSpec, t: number): VariableSpec => ({
  topValue: lerp(a.topValue, b.topValue, t),
  bottomValue: lerp(a.bottomValue, b.bottomValue, t),
  enter: lerp(a.enter, b.enter, t),
  exit: lerp(a.exit, b.exit, t),
});

/** `responsiveTransformationSpec(screenSize, Specs)`: clamp to the ends, interpolate between. */
function specFor(screen: number): ResponsiveSpec {
  if (screen <= SMALL.screenSize) return SMALL;
  if (screen >= LARGE.screenSize) return LARGE;
  const t = inverseLerp(SMALL.screenSize, LARGE.screenSize, screen);
  return {
    screenSize: screen,
    minElementHeightFraction: lerp(SMALL.minElementHeightFraction, LARGE.minElementHeightFraction, t),
    maxElementHeightFraction: lerp(SMALL.maxElementHeightFraction, LARGE.maxElementHeightFraction, t),
    minTransitionAreaHeightFraction: lerp(SMALL.minTransitionAreaHeightFraction, LARGE.minTransitionAreaHeightFraction, t),
    maxTransitionAreaHeightFraction: lerp(SMALL.maxTransitionAreaHeightFraction, LARGE.maxTransitionAreaHeightFraction, t),
    containerAlpha: lerpVar(SMALL.containerAlpha, LARGE.containerAlpha, t),
    contentAlpha: lerpVar(SMALL.contentAlpha, LARGE.contentAlpha, t),
    scale: lerpVar(SMALL.scale, LARGE.scale, t),
  };
}

/** CubicBezierEasing(0.3, 0, 0.7, 1). */
function ease(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 20; i++) {
    const bx = 3 * (1 - t) ** 2 * t * 0.3 + 3 * (1 - t) * t * t * 0.7 + t ** 3;
    if (Math.abs(bx - x) < 1e-5) break;
    if (bx < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) * t * t + t ** 3;
}

/**
 * `TransitionAreaProgress(scrollProgress)`: which edge zone the item is in and how far through it
 * (0 = entering the screen, 1 = leaving the zone towards the centre). Null = not transforming.
 */
function transitionArea(spec: ResponsiveSpec, top: number, bottom: number): { top: boolean; progress: number } | null {
  const relativeItemHeight = bottom - top;
  const sizeRatio = inverseLerp(spec.minElementHeightFraction, spec.maxElementHeightFraction, relativeItemHeight);
  const scalingLine = Math.min(
    lerp(spec.minTransitionAreaHeightFraction, spec.maxTransitionAreaHeightFraction, sizeRatio),
    (1 + relativeItemHeight) / 2, // the two zones never overlap
  );
  if (bottom < 1 - top) {
    const p = bottom / scalingLine;
    return p >= 1 ? null : { top: true, progress: Math.max(0, p) };
  }
  const p = (1 - top) / scalingLine;
  return p >= 1 ? null : { top: false, progress: Math.max(0, p) };
}

/** `TransitionAreaProgress.compute(variable, easing)`. */
function compute(variable: VariableSpec, area: { top: boolean; progress: number } | null): number {
  if (!area) return 1;
  const edge = area.top ? variable.topValue : variable.bottomValue;
  return lerp(edge, 1, ease(inverseLerp(variable.enter, variable.exit, area.progress)));
}

/**
 * A Wear OS Material 3 transforming list — a vertically scrolling column whose items shrink and
 * fade as they approach the top and bottom edges of a round screen, ported from AndroidX Wear
 * `TransformingLazyColumn` with the default `rememberTransformationSpec()`
 * (`ResponsiveTransformationSpec` small 192dp / large 240dp, interpolated by screen size).
 *
 * The element itself is the scroll container, so it can be the `for` target of
 * `m3e-wear-scroll-indicator` and `m3e-edge-button`.
 *
 * Differences from Compose: items keep their layout height (the scroll height never changes while
 * scrolling); instead they are visually re-packed around the item nearest the screen centre using
 * their transformed heights, which looks like the Compose layout. Transition zones are measured
 * against the enclosing `m3e-wear-screen`. Items marked `data-no-transform` are not scaled.
 *
 * @tag m3e-wear-transforming-list
 *
 * @attr screen-size - Screen size in px used to pick the spec; defaults to the enclosing
 *   `m3e-wear-screen` (or this element's width).
 * @attr no-transform - Disable the transformation (also off under `prefers-reduced-motion`).
 *
 * @slot - The list items.
 *
 * @cssprop --m3e-wear-transforming-list-gap - Space between items (default 4px).
 *
 * Each item also receives `--m3e-tlc-content-alpha` (the spec's contentAlpha) for content that
 * should fade separately from its container.
 */
@customElement("m3e-wear-transforming-list")
export class M3eWearTransformingListElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--m3e-wear-transforming-list-gap, 4px);
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      scrollbar-width: none;
      /* Positioned, so items' offsetTop is measured from this scroll container. */
      position: relative;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    :host([hidden]) {
      display: none;
    }
    ::slotted(*) {
      flex: none;
      will-change: transform, opacity;
    }
  `;

  /** Screen size in px used to pick the transformation spec (0 = detect). @default 0 */
  @property({ type: Number, attribute: "screen-size" }) screenSize = 0;

  /** Disable item transformation. @default false */
  @property({ type: Boolean, attribute: "no-transform" }) noTransform = false;

  /** @private */ #raf = 0;
  /** @private */ #ro?: ResizeObserver;
  /** @private */ #mo?: MutationObserver;
  /** @private */ #reduceMotion = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("scroll", this.#schedule, { passive: true });
    this.#reduceMotion?.addEventListener("change", this.#schedule);
    if (typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(this.#schedule);
      this.#ro.observe(this);
      for (const c of Array.from(this.children)) this.#ro.observe(c);
    }
    if (typeof MutationObserver !== "undefined") {
      this.#mo = new MutationObserver((records) => {
        for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && this.#ro?.observe(n));
        this.#schedule();
      });
      this.#mo.observe(this, { childList: true });
    }
    this.#schedule();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this.#schedule);
    this.#reduceMotion?.removeEventListener("change", this.#schedule);
    this.#ro?.disconnect();
    this.#mo?.disconnect();
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#schedule();
  }

  /** @private */
  #schedule = (): void => {
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      this.#apply();
    });
  };

  /** @private */
  #screenSize(): number {
    if (this.screenSize > 0) return this.screenSize;
    const screen = this.closest("m3e-wear-screen") as HTMLElement | null;
    return screen?.clientWidth || this.clientWidth || SMALL.screenSize;
  }

  /** @private */
  #apply(): void {
    const items = (Array.from(this.children) as HTMLElement[]).filter((el) => el.offsetParent === this);
    const off = this.noTransform || !!this.#reduceMotion?.matches;
    if (off || this.clientHeight <= 0) {
      for (const el of Array.from(this.children) as HTMLElement[]) this.#reset(el);
      return;
    }
    const spec = specFor(this.#screenSize());
    // Fractions are measured against the whole round screen (TransformingLazyColumn fills it),
    // not this element's own viewport, which the screen padding / content padding inset.
    const listBox = this.getBoundingClientRect();
    const screenEl = (this.closest("m3e-wear-screen") as HTMLElement | null) ?? this;
    const screenBox = screenEl.getBoundingClientRect();
    const screenTop = screenBox.top;
    const screenH = screenBox.height || this.clientHeight;
    const originY = listBox.top + this.clientTop - this.scrollTop; // client y of offsetTop 0
    const gap = parseFloat(getComputedStyle(this).rowGap) || 0;

    // Layout boxes (offsetTop/offsetHeight ignore our transforms, so there's no feedback loop).
    const n = items.length;
    const top = new Array<number>(n);
    const h = new Array<number>(n);
    const scale = new Array<number>(n);
    const area = new Array<ReturnType<typeof transitionArea>>(n);
    let anchor = -1;
    let anchorDist = Infinity;
    for (let i = 0; i < n; i++) {
      const el = items[i];
      top[i] = originY + el.offsetTop;
      h[i] = el.offsetHeight;
      const fixed = el.hasAttribute("data-no-transform");
      area[i] = fixed ? null : transitionArea(spec, (top[i] - screenTop) / screenH, (top[i] + h[i] - screenTop) / screenH);
      scale[i] = compute(spec.scale, area[i]);
      // Anchor the packing on the item nearest the screen centre (like the TLC's anchor item).
      const d = Math.abs(top[i] + h[i] / 2 - (screenTop + screenH / 2));
      if (d < anchorDist) {
        anchorDist = d;
        anchor = i;
      }
    }

    // Re-pack around the anchor using the transformed heights, as the Compose layout does with
    // getTransformedHeight: shrunk items pull towards the centre instead of leaving gaps.
    const newTop = top.slice();
    for (let i = anchor + 1; i < n; i++) newTop[i] = newTop[i - 1] + h[i - 1] * scale[i - 1] + gap;
    for (let i = anchor - 1; i >= 0; i--) newTop[i] = newTop[i + 1] - gap - h[i] * scale[i];

    for (let i = 0; i < n; i++) {
      const el = items[i];
      const a = area[i];
      const shift = newTop[i] - top[i];
      if (!a && Math.abs(shift) < 0.01) {
        this.#reset(el);
        continue;
      }
      el.style.transformOrigin = "50% 0";
      el.style.transform = `translateY(${shift}px) scale(${scale[i]})`;
      el.style.opacity = a ? String(compute(spec.containerAlpha, a)) : "";
      el.style.setProperty("--m3e-tlc-content-alpha", String(compute(spec.contentAlpha, a)));
    }
  }

  /** @private */
  #reset(el: HTMLElement): void {
    el.style.transform = "";
    el.style.transformOrigin = "";
    el.style.opacity = "";
    el.style.removeProperty("--m3e-tlc-content-alpha");
  }

  protected override render(): unknown {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-wear-transforming-list": M3eWearTransformingListElement;
  }
}
