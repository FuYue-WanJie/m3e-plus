import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property, query, state } from "lit/decorators.js";

import { customElement, prefersReducedMotion } from "@wanjie/m3e-web/core";
import { SpringSimulation } from "@wanjie/m3e-web/physics";

import {
  CarouselDefaults,
  Strategy,
  carouselItemPlacement,
  calculateMaxScrollOffset,
  emptyKeylineList,
  getSnapPositionOffset,
  heroKeylineList,
  multiBrowseKeylineList,
  uncontainedKeylineList,
  type KeylineList,
} from "./carousel-keylines";

/** Carousel layout strategies (M3 expressive). */
export type CarouselLayout = "multi-browse" | "uncontained" | "hero";

/** Pager-like constants (one CSS px per dp). */
const MIN_FLING_VELOCITY = 400;
const MAX_FLING_VELOCITY = 8000;
/** StiffnessMediumLow, critically damped — the pager's snap spring. */
const SNAP_SPRING = { stiffness: 400, dampingRatio: 1 };
/** ExtraLarge corner used to mask items (`maskClip(shapes.extraLarge)`). */
const MASK_CORNER = "var(--m3e-shape-corner-extra-large, 28px)";

/**
 * A Material 3 expressive carousel.
 *
 * @description
 * Lays out items in a keyline-driven focal layout (one large focal item with medium/small neighbours
 * that scale and slide as you scroll). Drag to scroll; on release it snaps (multi-browse / hero) or
 * coasts with decay (uncontained). Items are masked to their interpolated keyline size with an
 * extra-large corner and layered in front by proximity to the focal item.
 *
 * @tag m3e-carousel
 *
 * @attr layout - `multi-browse` (default), `uncontained` or `hero`.
 * @attr preferred-item-width - Preferred width of the large (focal) item, in px.
 * @attr item-width - Fixed item width for `uncontained`, in px.
 * @attr item-spacing - Space between items, in px (default 0).
 * @attr content-padding - Start/end padding, in px (default 0).
 * @attr active-index - The current item index (readonly-reflected as it changes).
 * @attr user-scroll-enabled - Whether pointer/keyboard scrolling is allowed (default true).
 */
@customElement("m3e-carousel")
export class M3eCarouselElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: relative;
      -webkit-tap-highlight-color: transparent;
    }
    :host([hidden]) {
      display: none;
    }
    .viewport {
      position: relative;
      display: grid;
      height: 100%;
      overflow: hidden;
      outline: none;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }
    .viewport:focus-visible {
      outline: 3px solid var(--m3e-color-secondary, #625b71);
      outline-offset: 2px;
      border-radius: var(--m3e-shape-corner-extra-large, 28px);
    }
    .viewport {
      /* grid container so every item stacks in the same cell (1/1) */
      grid-auto-flow: row;
    }
    ::slotted(*) {
      display: block;
      box-sizing: border-box;
      grid-area: 1 / 1;
      position: relative;
      justify-self: start;
      align-self: stretch;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      will-change: transform;
      object-fit: cover;
    }
    ::slotted([data-offscreen]) {
      visibility: hidden;
    }
  `;

  /** The layout strategy. @default "multi-browse" */
  @property({ reflect: true, useDefault: true }) layout: CarouselLayout = "multi-browse";

  /** Preferred width of the focal item, in px. @default 220 */
  @property({ attribute: "preferred-item-width", type: Number }) preferredItemWidth = 220;

  /** Fixed item width for `uncontained`, in px. @default 220 */
  @property({ attribute: "item-width", type: Number }) itemWidth = 220;

  /** Space between items, in px. @default 0 */
  @property({ attribute: "item-spacing", type: Number }) itemSpacing = CarouselDefaults.ItemSpacing;

  /** Minimum small item width, in px. @default 40 */
  @property({ attribute: "min-small-item-width", type: Number }) minSmallItemWidth = CarouselDefaults.MinSmallItemSize;

  /** Maximum small item width, in px. @default 56 */
  @property({ attribute: "max-small-item-width", type: Number }) maxSmallItemWidth = CarouselDefaults.MaxSmallItemSize;

  /** Start/end padding, in px. @default 0 */
  @property({ attribute: "content-padding", type: Number }) contentPadding = 0;

  /** Whether user scrolling is enabled. @default true */
  @property({ attribute: "user-scroll-enabled", type: Boolean }) userScrollEnabled = true;

  /** The current (focal) item index. */
  @property({ attribute: "active-index", type: Number, reflect: true }) activeIndex = 0;

  /** @private */ @state() private _pageSize = 0;

  @query(".viewport") private readonly _viewport?: HTMLElement;

  /** @private Current scroll offset in px. */
  #scroll = 0;
  /** @private The active strategy (rebuilt on size/content change). */
  #strategy: Strategy = new Strategy(emptyKeylineList(), 0, 0, 0, 0);
  /** @private Measured available space. */
  #available = 0;
  /** @private Item host elements (slotted children). */
  #items: HTMLElement[] = [];
  /** @private Per-item cached last values to avoid redundant DOM writes. */
  readonly #cache = new WeakMap<HTMLElement, { x: number; mask: string; z: number; hidden: boolean }>();
  /** @private Active snap/coast spring. */
  #spring?: SpringSimulation;
  /** @private rAF id for a running spring frame loop. */
  #raf = 0;
  /** @private Drag state. */
  #drag?: { pointerId: number; startX: number; startScroll: number; startItem: number; lastX: number; lastT: number; velocity: number; active: boolean };
  /** @private RTL. */
  #rtl = false;

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();
    this.#rtl = getComputedStyle(this).direction === "rtl";
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopMotion();
  }

  /** @inheritdoc */
  protected override firstUpdated(_changed: PropertyValues): void {
    super.firstUpdated(_changed);
    // Observe the viewport size to rebuild the strategy and re-lay out.
    if (typeof ResizeObserver !== "undefined" && this._viewport) {
      this.#resizeObserver = new ResizeObserver(() => this.#measure());
      this.#resizeObserver.observe(this._viewport);
    }
    this.#measure();
  }

  /** @private */ #resizeObserver?: ResizeObserver;

  /** @inheritdoc */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this._pageSize !== this.#pageSizeOf()) {
      this._pageSize = this.#pageSizeOf();
    }
    if (changed.has("layout") || changed.has("preferredItemWidth") || changed.has("itemWidth") || changed.has("itemSpacing") || changed.has("contentPadding")) {
      this.#measure();
    }
  }

  /** @inheritdoc */
  override render(): unknown {
    return html`<div
      class="viewport"
      style="--_page-size:${this._pageSize}px"
      tabindex="0"
      role="region"
      aria-roledescription="carousel"
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerUp}
      @pointercancel=${this.#onPointerUp}
      @keydown=${this.#onKeyDown}
    >
      <slot @slotchange=${this.#onSlotChange}></slot>
    </div>`;
  }

  /** @private The page (focal) size in px. */
  #pageSizeOf(): number {
    return this.#strategy.isValid ? Math.round(this.#strategy.itemMainAxisSize) : this.#available;
  }

  /** @private Refresh items, rebuild the strategy and re-lay out. */
  #onSlotChange(): void {
    this.#items = Array.from(this.querySelectorAll<HTMLElement>(":scope > *"));
    this.#measure(true);
  }

  /** @private Rebuild the strategy from the measured size + items, keeping the active item. */
  #measure(resetToActive = false): void {
    const viewport = this._viewport;
    if (!viewport) return;
    const available = viewport.clientWidth;
    if (available <= 0) return;
    const spacing = Math.round(this.itemSpacing);
    const padding = Math.round(this.contentPadding);
    const count = this.#items.length;

    let keylines: KeylineList;
    if (this.layout === "uncontained") {
      keylines = uncontainedKeylineList({ carouselMainAxisSize: available, itemSize: this.itemWidth, itemSpacing: spacing });
    } else if (this.layout === "hero") {
      keylines = heroKeylineList({ carouselMainAxisSize: available, preferredItemSize: this.preferredItemWidth, itemSpacing: spacing, itemCount: count, isCentered: true });
    } else {
      keylines = multiBrowseKeylineList({
        carouselMainAxisSize: available,
        preferredItemSize: this.preferredItemWidth,
        itemSpacing: spacing,
        itemCount: count,
        minSmallItemSize: this.minSmallItemWidth,
        maxSmallItemSize: this.maxSmallItemWidth,
      });
    }
    this.#strategy = new Strategy(keylines, available, spacing, padding, padding);
    this.#available = available;
    this._pageSize = this.#pageSizeOf();

    // Set the fixed page width on every item box (the pager's item size).
    for (const item of this.#items) {
      item.style.width = `${this._pageSize}px`;
      this.#cache.delete(item);
    }

    const keepItem = Math.min(Math.max(0, this.activeIndex), Math.max(0, count - 1));
    this.#scroll = this.#scrollForItem(keepItem);
    void resetToActive;
    this.#draw();
  }

  /** @private The scroll offset that rests item `index` at the start. */
  #scrollForItem(index: number): number {
    const strategy = this.#strategy;
    if (!strategy.isValid) return 0;
    // page -> scroll: page * (itemSize + spacing) minus the snap offset (see calculateCurrentScrollOffset).
    const stride = strategy.itemMainAxisSize + strategy.itemSpacing;
    const raw = index * stride - getSnapPositionOffset(strategy, index, this.#items.length);
    return Math.min(Math.max(0, raw), this.#maxScroll());
  }

  /** @private */ #maxScroll(): number {
    return calculateMaxScrollOffset(this.#strategy, this.#items.length);
  }

  /** @private Map the current scroll to per-item placement; write only changed props. */
  #draw(): void {
    const strategy = this.#strategy;
    const count = this.#items.length;
    if (!strategy.isValid || !count) {
      for (const item of this.#items) this.#setHidden(item, true);
      return;
    }
    const maxScroll = this.#maxScroll();
    const scroll = this.#scroll;
    const pageSize = this._pageSize;
    const avail = this.#available;
    // The focal page index = the item whose resting scroll position is nearest the current scroll.
    let current = 0;
    let bestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(this.#scrollForItem(i) - scroll);
      if (d < bestDist) {
        bestDist = d;
        current = i;
      }
    }

    // Visible-range cull: only items whose unadjusted slot is near the viewport can be on screen.
    // Items outside this index window are hidden without computing their placement (perf).
    const stride = pageSize + strategy.itemSpacing;
    const lo = stride > 0 ? Math.max(0, Math.floor((scroll - stride) / stride) - 1) : 0;
    const hi = stride > 0 ? Math.min(count - 1, Math.ceil((scroll + avail + stride) / stride) + 1) : count - 1;

    for (let index = 0; index < count; index++) {
      const item = this.#items[index];
      if (index < lo || index > hi) {
        this.#setHidden(item, true);
        continue;
      }
      const placement = carouselItemPlacement(strategy, index, scroll, maxScroll);
      const pageOffset = index * (pageSize + strategy.itemSpacing);
      const left = pageOffset + placement.translation;
      const visibleStart = left + placement.maskStart;
      const visibleEnd = left + placement.maskEnd;
      const hidden = placement.size <= 0 || visibleEnd <= 0 || visibleStart >= avail;
      const x = this.#rtl ? avail - left - pageSize : left;

      let cached = this.#cache.get(item);
      if (!cached) {
        cached = { x: NaN, mask: "", z: -1, hidden: false };
        this.#cache.set(item, cached);
      }
      if (cached.x !== x) {
        item.style.transform = `translateX(${x}px)`;
        cached.x = x;
      }
      const maskEndInset = pageSize - placement.maskEnd;
      const maskKey = `${placement.maskStart.toFixed(2)}|${maskEndInset.toFixed(2)}`;
      if (cached.mask !== maskKey) {
        item.style.clipPath = `inset(0px ${maskEndInset}px 0px ${placement.maskStart}px round ${MASK_CORNER})`;
        cached.mask = maskKey;
      }
      const z = count - Math.abs(index - current);
      if (cached.z !== z) {
        item.style.zIndex = String(z);
        cached.z = z;
      }
      this.#setHidden(item, hidden);
    }

    if (current !== this.activeIndex && current >= 0 && current < count) {
      this.activeIndex = current;
      this.dispatchEvent(new CustomEvent("change", { detail: { index: current }, bubbles: true, composed: true }));
    }
  }

  /** @private */ #setHidden(item: HTMLElement, hidden: boolean): void {
    const cached = this.#cache.get(item);
    const prev = cached?.hidden ?? false;
    if (cached && prev === hidden) return;
    item.toggleAttribute("data-offscreen", hidden);
    if (cached) cached.hidden = hidden;
  }

  // ── Scroll / drag / snap ──────────────────────────────────────────────────────────────────────

  /** @private Apply a raw scroll delta, clamped; redraw. Returns consumed px. */
  #scrollBy(delta: number): number {
    const target = this.#scroll + delta;
    const next = Math.min(Math.max(0, target), this.#maxScroll());
    const consumed = next === target ? delta : next - this.#scroll;
    this.#scroll = next;
    if (consumed !== 0) this.#draw();
    return consumed;
  }

  /** @private */ #onPointerDown(e: PointerEvent): void {
    if (!this.userScrollEnabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    this.#stopMotion();
    this.#drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: this.#scroll,
      startItem: this.#activeItemIndex(),
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      active: false,
    };
    this._viewport?.setPointerCapture(e.pointerId);
  }

  /** @private */ #onPointerMove(e: PointerEvent): void {
    const drag = this.#drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    // Respect the touch-slop before starting to scroll, like the pager.
    if (!drag.active) {
      if (Math.abs(dx) < 10) return;
      drag.active = true;
    }
    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.velocity = ((e.clientX - drag.lastX) / dt) * 1000;
    drag.lastX = e.clientX;
    drag.lastT = now;
    // Dragging right moves content right = scroll back (LTR). Invert for RTL.
    const movement = this.#rtl ? dx : -dx;
    this.#scroll = Math.min(Math.max(0, drag.startScroll + movement), this.#maxScroll());
    this.#draw();
  }

  /** @private */ #onPointerUp(e: PointerEvent): void {
    const drag = this.#drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.#drag = undefined;
    try {
      this._viewport?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!drag.active) return;
    // Scroll velocity forward = -clientX velocity in LTR (drag left scrolls forward).
    const scrollVelocity = this.#rtl ? drag.velocity : -drag.velocity;
    this.#release(scrollVelocity, drag.startItem);
  }

  /** @private Keyboard: arrow keys move one item. */
  #onKeyDown(e: KeyboardEvent): void {
    if (!this.userScrollEnabled) return;
    const forward = this.#rtl ? "ArrowLeft" : "ArrowRight";
    const back = this.#rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) {
      e.preventDefault();
      this.#scrollToItem(this.activeIndex + 1);
    } else if (e.key === back) {
      e.preventDefault();
      this.#scrollToItem(this.activeIndex - 1);
    }
  }

  /** @private Animate to item `index` (keyboard / API). */
  #scrollToItem(index: number): void {
    const count = this.#items.length;
    const clamped = Math.min(Math.max(0, index), count - 1);
    this.#animateScrollTo(this.#scrollForItem(clamped), 0);
  }

  /** @private On release: snap (multi-browse/hero) or coast-decay (uncontained). */
  #release(velocity: number, startItem: number): void {
    const strategy = this.#strategy;
    if (!strategy.isValid) return;
    if (this.layout === "uncontained") {
      this.#coast(velocity);
      return;
    }
    const count = this.#items.length;
    // singleAdvance (PagerSnapDistance.atMost(1)): the target is the item nearest the current
    // scroll, but a fast flick may carry it at most one page beyond the item we started on.
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const dist = Math.abs(this.#scrollForItem(i) - this.#scroll);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    const dir = velocity > 0 ? 1 : -1;
    let target = nearest;
    // A fast flick that stayed within the starting item still advances to the next one; if the drag
    // already reached a different item, nearest already reflects it (don't advance further).
    if (Math.abs(velocity) > MIN_FLING_VELOCITY && nearest === startItem) {
      target = nearest + dir;
    }
    target = Math.min(Math.max(0, target), count - 1);
    this.#animateScrollTo(this.#scrollForItem(target), velocity);
  }

  /** @private The item index whose resting scroll is nearest the current scroll. */
  #activeItemIndex(): number {
    const count = this.#items.length;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(this.#scrollForItem(i) - this.#scroll);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** @private Coast with a decaying velocity (`noSnapFlingBehavior`, spline-like friction). */
  #coast(velocity: number): void {
    if (prefersReducedMotion() || Math.abs(velocity) < MIN_FLING_VELOCITY) return;
    let v = Math.min(Math.max(velocity, -MAX_FLING_VELOCITY), MAX_FLING_VELOCITY);
    let last = performance.now();
    const friction = 0.998; // per-ms velocity multiplier (exponential decay)
    const step = (now: number): void => {
      const dt = Math.min(64, now - last);
      last = now;
      const delta = (v * dt) / 1000;
      const consumed = this.#scrollBy(delta);
      v *= Math.pow(friction, dt);
      const atBound = consumed !== delta;
      if (Math.abs(v) < MIN_FLING_VELOCITY || atBound) {
        this.#settle();
        return;
      }
      this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** @private Animate the scroll to `target` with the snap spring from `velocity`. */
  #animateScrollTo(target: number, velocity: number): void {
    const from = this.#scroll;
    const distance = target - from;
    if (prefersReducedMotion() || Math.abs(distance) < 0.5) {
      this.#scrollBy(distance);
      this.#settle();
      return;
    }
    this.#stopMotion();
    // The spring animates progress 0..1 over `distance`; convert the pixel/s release velocity into
    // progress units/s, clamped so it only adds momentum (never flings past the chosen target).
    const progressVelocity = distance !== 0 ? Math.max(-3, Math.min(3, velocity / Math.abs(distance))) : 0;
    const spring = new SpringSimulation({ ...SNAP_SPRING, value: 0, velocity: progressVelocity });
    this.#spring = spring;
    let consumed = 0;
    spring.start(
      1,
      (frame) => {
        // Clamp progress so the snap never overshoots the chosen target (Compose coerces too).
        const v = Math.min(1, Math.max(0, frame.value));
        const desired = from + distance * v;
        const delta = desired - (from + consumed);
        const used = this.#scrollBy(delta);
        consumed += used;
        // Stop early if clamped at a bound.
        if (used !== delta) {
          spring.stop();
          this.#settle();
        }
      },
      () => this.#settle(),
    );
  }

  /** @private */ #stopMotion(): void {
    this.#spring?.stop();
    this.#spring = undefined;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** @private */ #settle(): void {
    this.#stopMotion();
    this.dispatchEvent(new CustomEvent("settle", { detail: { index: this.activeIndex }, bubbles: true, composed: true }));
  }

  // ── Public API ──────────────────────────────────────────────────────────────────────────────────

  /** The item count. */
  get itemCount(): number {
    return this.#items.length;
  }

  /** Scroll to the given item index with the default spring. */
  scrollToItem(index: number): void {
    this.#scrollToItem(index);
  }

  /** @internal Debug snapshot (for tests/probes). */
  get debugState(): { scroll: number; maxScroll: number; active: number; drag?: { active: boolean; velocity: number } } {
    return {
      scroll: this.#scroll,
      maxScroll: this.#maxScroll(),
      active: this.activeIndex,
      drag: this.#drag ? { active: this.#drag.active, velocity: this.#drag.velocity } : undefined,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-carousel": M3eCarouselElement;
  }
}
