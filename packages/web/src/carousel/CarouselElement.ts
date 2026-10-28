import { css, CSSResultGroup, html, LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { customElement, prefersReducedMotion } from "@wanjie/m3e-web/core";

import {
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
import {
  EXPRESSIVE_SNAP_SPRING,
  FlingDecay,
  MAX_FLING_VELOCITY,
  MIN_FLING_VELOCITY,
  POSITION_THRESHOLD,
  SCROLL_SPRING,
  SNAP_POSITIONAL_THRESHOLD,
  STANDARD_SNAP_SPRING,
  VelocityTracker,
  springSolve,
  touchSlop,
  type CarouselSpring,
} from "./carousel-motion";
import { M3eCarouselItemElement } from "./CarouselItemElement";

/** Carousel layouts (M3 Expressive). */
export type CarouselLayout = "multi-browse" | "hero" | "uncontained" | "full-screen";

/** Snap springs: `standard` is Compose's critically damped pager spring, `expressive` may bounce. */
export type CarouselMotion = "standard" | "expressive";

const fr = Math.fround;
/** Fallback mask corner when the item does not resolve one. */
const DEFAULT_CORNER = 28;

interface ItemCache {
  vis: number;
  x: number;
  len: number;
  radius: number;
  clip: string;
  offset: number;
  label: number;
}

interface Drag {
  id: number;
  start: number;
  startCross: number;
  last: number;
  moved: boolean;
  slop: number;
  tracker: VelocityTracker;
}

interface Motion {
  raf: number;
  t: number;
  last: number;
}

/**
 * A Material 3 Expressive carousel.
 *
 * @description
 * Lays out items along keylines: a large focal item with medium and small neighbours that grow and
 * shrink as the carousel scrolls, following AndroidX `HorizontalMultiBrowseCarousel`,
 * `HorizontalUncontainedCarousel` and `HorizontalCenteredHeroCarousel`. Drag, flick, wheel and
 * keyboard are supported; releases snap with the pager's fling behaviours (multi-browse, single
 * advance for hero / full-screen) or coast with Android's fling decay (uncontained).
 *
 * Use `m3e-carousel-item` children for the best result: the carousel then resizes only the item's
 * mask while its picture stays on a fixed-size layer. Other children are masked with `clip-path`.
 *
 * The carousel takes its cross-axis size from CSS (give it a height, or a width when `vertical`).
 *
 * @example
 * ```html
 * <m3e-carousel style="height: 220px">
 *   <m3e-carousel-item><img src="a.jpg" alt="" /><span slot="label">Dawn</span></m3e-carousel-item>
 *   <m3e-carousel-item><img src="b.jpg" alt="" /></m3e-carousel-item>
 * </m3e-carousel>
 * ```
 *
 * @tag m3e-carousel
 *
 * @slot - Carousel items, usually `m3e-carousel-item`.
 *
 * @attr layout - `multi-browse` (default), `hero`, `uncontained` or `full-screen`.
 * @attr centered - For `hero`: center the focal item between two small items.
 * @attr vertical - Scroll vertically (typical for `full-screen`).
 * @attr preferred-item-size - Preferred main-axis size of the focal item, in px (multi-browse, hero).
 * @attr item-size - Item main-axis size for `uncontained`, in px.
 * @attr item-spacing - Space between items, in px.
 * @attr min-small-item-size - Minimum small item size, in px.
 * @attr max-small-item-size - Maximum small item size, in px.
 * @attr content-padding - Padding before the first and after the last item, in px.
 * @attr motion - Snap spring: `standard` (default) or `expressive`.
 * @attr user-scroll-enabled - Whether pointer, wheel and keyboard scrolling is allowed.
 * @attr active-index - Index of the item at the current snap position.
 *
 * @fires change - The active item changed; `detail.index`.
 * @fires settle - Scrolling came to rest; `detail.index`.
 */
@customElement("m3e-carousel")
export class M3eCarouselElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: relative;
      outline: none;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host([vertical]) {
      touch-action: pan-x;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:focus-visible) {
      outline: 3px solid var(--m3e-focus-ring-color, var(--md-sys-color-secondary, #625b71));
      outline-offset: 2px;
      border-radius: var(--m3e-shape-corner-extra-large, 28px);
    }
    .track {
      position: absolute;
      inset: 0;
      overflow: hidden;
      contain: strict;
      will-change: transform;
    }
    ::slotted(*) {
      position: absolute !important;
      top: 0;
      left: 0;
      box-sizing: border-box;
      margin: 0;
      visibility: hidden;
    }
    ::slotted(:not(m3e-carousel-item)) {
      overflow: hidden;
      object-fit: cover;
    }
  `;

  /** The layout. @default "multi-browse" */
  @property({ reflect: true }) layout: CarouselLayout = "multi-browse";

  /** For `hero`: center the focal item. @default false */
  @property({ type: Boolean, reflect: true }) centered = false;

  /** Scroll vertically. @default false */
  @property({ type: Boolean, reflect: true }) vertical = false;

  /** Preferred focal item size, in px. @default 220 */
  @property({ attribute: "preferred-item-size", type: Number }) preferredItemSize = 220;

  /** Item size for `uncontained`, in px. @default 220 */
  @property({ attribute: "item-size", type: Number }) itemSize = 220;

  /** Space between items, in px. @default 8 */
  @property({ attribute: "item-spacing", type: Number }) itemSpacing = 8;

  /** Minimum small item size, in px. @default 40 */
  @property({ attribute: "min-small-item-size", type: Number }) minSmallItemSize = 40;

  /** Maximum small item size, in px. @default 56 */
  @property({ attribute: "max-small-item-size", type: Number }) maxSmallItemSize = 56;

  /** Padding before the first and after the last item, in px. @default 0 */
  @property({ attribute: "content-padding", type: Number }) contentPadding = 0;

  /** Snap spring. @default "standard" */
  @property({ reflect: true }) motion: CarouselMotion = "standard";

  /** Whether user scrolling is enabled. @default true */
  @property({ attribute: "user-scroll-enabled", type: Boolean, converter: { fromAttribute: (v) => v !== "false" } })
  userScrollEnabled = true;

  /** Index of the item at the current snap position. */
  @property({ attribute: "active-index", type: Number, reflect: true }) activeIndex = 0;

  /** @private */ #track?: HTMLElement;
  /** @private */ #items: HTMLElement[] = [];
  /** @private */ readonly #cache = new WeakMap<HTMLElement, ItemCache>();
  /** @private */ #strategy = new Strategy(emptyKeylineList(), 0, 0, 0, 0);
  /** @private */ #keylines: KeylineList = emptyKeylineList();
  /** @private Main-axis size of the carousel. */
  #size = 0;
  /** @private Focal item (page) size. */
  #page = 0;
  /** @private */ #max = 0;
  /** @private Scroll offset; outside [0, max] while overscrolling. */
  #pos = 0;
  /** @private Resting scroll offset of each item. */
  #snaps: number[] = [];
  /** @private Distinct snap offsets, ascending. */
  #stops: number[] = [];
  /** @private */ #corner = DEFAULT_CORNER;
  /** @private */ #rtl = false;
  /** @private */ #motion?: Motion;
  /** @private Where a running animation is heading. */
  #target: number | null = null;
  /** @private */ #drag?: Drag;
  /** @private */ #suppressClick = false;
  /** @private */ #renderQueued = 0;
  /** @private */ #wheelTimer = 0;
  /** @private */ #wheelLock = false;
  /** @private */ #lastTrackTransform = "";
  /** @private Set while this element itself updates `activeIndex`. */
  #internalIndex = false;
  /** @private */ #resizeObserver?: ResizeObserver;
  /** @private */ #flingVelocity = 0;

  constructor() {
    super();
    this.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
    this.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    this.addEventListener("pointerup", (e) => this.#onPointerUp(e, false));
    this.addEventListener("pointercancel", (e) => this.#onPointerUp(e, true));
    this.addEventListener("lostpointercapture", (e) => {
      // Touch gives the touched child an implicit capture; when we take the capture after the slop the
      // child's `lostpointercapture` bubbles here. Only our own lost capture cancels the drag.
      if (e.target === this && this.#drag?.moved && this.#drag.id === e.pointerId) this.#onPointerUp(e, true);
    });
    this.addEventListener("dragstart", (e) => e.preventDefault());
    this.addEventListener(
      "click",
      (e) => {
        if (this.#suppressClick) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    this.addEventListener("wheel", (e) => this.#onWheel(e), { passive: false });
    this.addEventListener("keydown", (e) => this.#onKeyDown(e));
  }

  /** The number of items. */
  get itemCount(): number {
    return this.#items.length;
  }

  /** @inheritdoc */
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    if (!this.hasAttribute("role")) this.setAttribute("role", "region");
    if (!this.hasAttribute("aria-roledescription")) this.setAttribute("aria-roledescription", "carousel");
    if (this.#track && !this.#resizeObserver) this.#observe();
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stop();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    cancelAnimationFrame(this.#renderQueued);
    this.#renderQueued = 0;
    clearTimeout(this.#wheelTimer);
  }

  /** @inheritdoc */
  override render(): unknown {
    return html`<div class="track" part="track"><slot @slotchange=${this.#onSlotChange}></slot></div>`;
  }

  /** @inheritdoc */
  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.#track = this.renderRoot.querySelector<HTMLElement>(".track") ?? undefined;
    this.#observe();
  }

  /** @inheritdoc */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const layoutKeys = [
      "layout",
      "centered",
      "vertical",
      "preferredItemSize",
      "itemSize",
      "itemSpacing",
      "minSmallItemSize",
      "maxSmallItemSize",
      "contentPadding",
    ];
    if (layoutKeys.some((k) => changed.has(k)) && changed.size && this.#track) this.#rebuild();
    if (changed.has("activeIndex") && !this.#internalIndex && changed.get("activeIndex") !== undefined) {
      this.scrollToItem(this.activeIndex);
    }
  }

  /**
   * Scrolls so item `index` sits at its snap position.
   * @param index The item index.
   * @param animate Whether to animate (ignored under reduced motion).
   */
  scrollToItem(index: number, animate = true): void {
    if (!this.#snaps.length) return;
    const target = this.#snaps[Math.max(0, Math.min(this.#snaps.length - 1, Math.round(index)))];
    if (!animate || prefersReducedMotion()) {
      this.#stop();
      this.#pos = target;
      this.#draw();
      this.#settled();
    } else this.#springTo(target, 0, SCROLL_SPRING);
  }

  // ── layout ────────────────────────────────────────────────────────────────────────────────────

  /** @private */ #observe(): void {
    if (typeof ResizeObserver === "undefined") return;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = new ResizeObserver(() => this.#rebuild());
    this.#resizeObserver.observe(this);
  }

  /** @private */ #onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    for (const old of this.#items) if (old.parentElement !== this) this.#reset(old);
    this.#items = slot.assignedElements({ flatten: true }) as HTMLElement[];
    this.#rebuild();
  }

  /** @private Undo the inline styles written on an item that left. */
  #reset(item: HTMLElement): void {
    for (const p of ["transform", "width", "height", "visibility", "borderRadius", "clipPath", "willChange"] as const) item.style[p] = "";
    item.removeAttribute("data-live");
    this.#cache.delete(item);
  }

  /** @private Rebuild the strategy for the current size, layout and item count, keeping the position. */
  #rebuild(): void {
    const rect = this.getBoundingClientRect();
    const size = Math.round(this.vertical ? rect.height : rect.width);
    const count = this.#items.length;
    if (!size) return;
    this.#rtl = !this.vertical && getComputedStyle(this).direction === "rtl";
    const fraction = this.#max > 0 ? Math.min(Math.max(this.#pos / this.#max, 0), 1) : 0;
    const spacing = Math.max(0, this.itemSpacing);
    const padding = Math.max(0, this.contentPadding);
    let keylines: KeylineList;
    switch (this.layout) {
      case "uncontained":
        keylines = uncontainedKeylineList({ carouselMainAxisSize: size, itemSize: Math.min(this.itemSize, size), itemSpacing: spacing });
        break;
      case "full-screen":
        keylines = uncontainedKeylineList({ carouselMainAxisSize: size, itemSize: size, itemSpacing: spacing });
        break;
      case "hero":
        keylines = heroKeylineList({
          carouselMainAxisSize: size,
          preferredItemSize: Math.min(this.preferredItemSize, size),
          itemSpacing: spacing,
          itemCount: count,
          isCentered: this.centered,
          minSmallItemSize: this.minSmallItemSize,
          maxSmallItemSize: this.maxSmallItemSize,
        });
        break;
      default:
        keylines = multiBrowseKeylineList({
          carouselMainAxisSize: size,
          preferredItemSize: Math.min(this.preferredItemSize, size),
          itemSpacing: spacing,
          itemCount: count,
          minSmallItemSize: this.minSmallItemSize,
          maxSmallItemSize: this.maxSmallItemSize,
        });
    }
    this.#keylines = keylines;
    this.#size = size;
    this.#strategy = new Strategy(keylines, size, spacing, padding, padding);
    this.#max = this.#strategy.isValid ? calculateMaxScrollOffset(this.#strategy, count) : 0;
    this.#page = this.#strategy.isValid ? this.#strategy.itemMainAxisSize : size;
    this.#snaps = [];
    for (let i = 0; i < count; i++) {
      const raw = i * (this.#page + spacing) - getSnapPositionOffset(this.#strategy, i, count);
      this.#snaps.push(Math.min(Math.max(raw, 0), this.#max));
    }
    this.#stops = [];
    for (const s of [...this.#snaps].sort((a, b) => a - b)) {
      if (!this.#stops.length || s - this.#stops[this.#stops.length - 1] > 0.5) this.#stops.push(s);
    }
    const first = this.#items[0];
    const corner = first ? parseFloat(getComputedStyle(first).borderTopLeftRadius) : NaN;
    this.#corner = Number.isFinite(corner) && corner > 0 ? corner : DEFAULT_CORNER;
    for (const item of this.#items) this.#cache.delete(item);

    if (this.#drag?.moved) {
      // keep the gesture going; positions are re-derived on the next move
      this.#pos = fraction * this.#max;
    } else {
      this.#stop();
      const resting = this.#snaps[Math.min(Math.max(this.activeIndex, 0), Math.max(0, count - 1))];
      this.#pos = this.#snapMode() ? (resting ?? 0) : fraction * this.#max;
    }
    this.#draw();
  }

  /** @private `null` coasts freely (uncontained), `multi` uses the multi-browse fling, `page` advances one item. */
  #snapMode(): "multi" | "page" | null {
    if (this.layout === "uncontained") return null;
    return this.layout === "multi-browse" ? "multi" : "page";
  }

  /** @private Item whose snap position is nearest `pos`. */
  #indexAt(pos: number): number {
    let best = 0;
    for (let i = 1; i < this.#snaps.length; i++) {
      if (Math.abs(this.#snaps[i] - pos) < Math.abs(this.#snaps[best] - pos) - 0.5) best = i;
    }
    return best;
  }

  /** @private */ #stopIndex(pos: number): number {
    let best = 0;
    this.#stops.forEach((s, i) => {
      if (Math.abs(s - pos) < Math.abs(this.#stops[best] - pos)) best = i;
    });
    return best;
  }

  /** @private Places every item for the current scroll offset, writing only what changed. */
  #draw(): void {
    const strategy = this.#strategy;
    const track = this.#track;
    if (!track) return;
    if (!strategy.isValid) {
      for (const item of this.#items) this.#hide(item);
      return;
    }
    const v = this.vertical;
    const size = this.#size;
    const page = this.#page;
    const pos = Math.min(Math.max(this.#pos, 0), this.#max);
    const over = this.#pos - pos;

    // Overscroll: stretch the track like Android 12+ instead of moving past the ends.
    const stretch = over === 0 ? 1 : 1 + Math.min(Math.abs(over) / size, 0.5) * 0.35;
    const lead = (over < 0) !== this.#rtl;
    const trackTransform = over === 0 ? "" : `${v ? "scaleY" : "scaleX"}(${stretch.toFixed(4)})`;
    if (trackTransform !== this.#lastTrackTransform) {
      this.#lastTrackTransform = trackTransform;
      track.style.transformOrigin = v ? (over < 0 ? "50% 0" : "50% 100%") : lead ? "0 50%" : "100% 50%";
      track.style.transform = trackTransform;
    }

    const stride = page + strategy.itemSpacing;
    const focal = this.#keylines.firstFocal.size;
    const minSize = strategy.minItemSize;
    const count = this.#items.length;
    const lo = Math.max(0, Math.floor((pos - stride) / stride) - 1);
    const hi = Math.min(count - 1, Math.ceil((pos + size + stride) / stride) + 1);

    for (let i = 0; i < count; i++) {
      const item = this.#items[i];
      if (i < lo || i > hi) {
        this.#hide(item);
        continue;
      }
      const p = carouselItemPlacement(strategy, i, pos, this.#max);
      const start = i * stride - pos + p.translation;
      const a = start + p.maskStart;
      const b = start + p.maskEnd;
      if (b < -1 || a > size + 1 || p.size <= 0.5) {
        this.#hide(item);
        continue;
      }
      let c = this.#cache.get(item);
      if (!c) {
        c = { vis: -1, x: NaN, len: NaN, radius: NaN, clip: "", offset: NaN, label: NaN };
        this.#cache.set(item, c);
      }
      if (c.vis !== 1) {
        c.vis = 1;
        item.style.visibility = "visible";
        item.setAttribute("data-live", "");
      }
      const round = (n: number): number => Math.round(n * 100) / 100;
      const len = round(b - a);
      // In RTL the whole main axis is mirrored.
      const x = round(this.#rtl ? size - b : a);
      const offset = round(this.#rtl ? p.maskEnd - page : -p.maskStart);
      const t = Math.max(0, Math.min(1, (p.size - Math.max(minSize, focal * 0.45)) / (focal * 0.35)));
      const label = Math.round(t * 50) / 50;

      if (item instanceof M3eCarouselItemElement) {
        if (c.x !== x) {
          c.x = x;
          item.style.transform = v ? `translate3d(0,${x}px,0)` : `translate3d(${x}px,0,0)`;
        }
        if (c.len !== len) {
          c.len = len;
          if (v) {
            item.style.height = `${len}px`;
            item.style.width = "100%";
          } else {
            item.style.width = `${len}px`;
            item.style.height = "100%";
          }
        }
        const radius = Math.round(Math.min(this.#corner, p.size / 2));
        if (c.radius !== radius) {
          c.radius = radius;
          item.style.borderRadius = radius >= this.#corner ? "" : `${radius}px`;
        }
        item._place(page, offset, label, v);
      } else {
        // Generic child: fixed page-size box moved by transform and masked by clip-path.
        const boxX = round(this.#rtl ? size - start - page : start);
        if (c.x !== boxX) {
          c.x = boxX;
          item.style.transform = v ? `translate3d(0,${boxX}px,0)` : `translate3d(${boxX}px,0,0)`;
        }
        if (c.len !== page) {
          c.len = page;
          item.style.width = v ? "100%" : `${page}px`;
          item.style.height = v ? `${page}px` : "100%";
        }
        const s = round(this.#rtl ? page - p.maskEnd : p.maskStart);
        const e = round(this.#rtl ? p.maskStart : page - p.maskEnd);
        const r = Math.round(Math.min(this.#corner, p.size / 2));
        const clip = v ? `inset(${s}px 0 ${e}px 0 round ${r}px)` : `inset(0 ${e}px 0 ${s}px round ${r}px)`;
        if (c.clip !== clip) {
          c.clip = clip;
          item.style.clipPath = clip;
        }
      }
    }

    const index = this.#indexAt(pos);
    if (index !== this.activeIndex && index < count) {
      this.#internalIndex = true;
      this.activeIndex = index;
      this.updateComplete.then(() => (this.#internalIndex = false));
      this.dispatchEvent(new CustomEvent("change", { detail: { index }, bubbles: true, composed: true }));
    }
  }

  /** @private */ #hide(item: HTMLElement): void {
    const c = this.#cache.get(item);
    if (c?.vis === 0) return;
    item.style.visibility = "hidden";
    item.removeAttribute("data-live");
    if (c) c.vis = 0;
    else this.#cache.set(item, { vis: 0, x: NaN, len: NaN, radius: NaN, clip: "", offset: NaN, label: NaN });
  }

  /** @private */ #requestDraw(): void {
    if (this.#motion || this.#renderQueued) return;
    this.#renderQueued = requestAnimationFrame(() => {
      this.#renderQueued = 0;
      this.#draw();
    });
  }

  // ── physics: every frame's movement is consumed through scrollBy, like Compose's ScrollScope ──

  /** @private Moves by `delta` within [0, max]; returns what was consumed. */
  #scrollBy(delta: number): number {
    const target = this.#pos + delta;
    const next = Math.min(Math.max(0, target), this.#max);
    const used = next === target ? delta : next - this.#pos;
    this.#pos = next;
    if (used !== 0) this.#draw();
    return used;
  }

  /** @private */ #stop(): void {
    if (this.#motion) cancelAnimationFrame(this.#motion.raf);
    this.#motion = undefined;
    this.#target = null;
  }

  /** @private Runs `step(elapsedMs)` every frame until it returns true. */
  #run(step: (ms: number) => boolean, done?: () => void): void {
    this.#stop();
    const m: Motion = { raf: 0, t: 0, last: performance.now() };
    this.#motion = m;
    const tick = (now: number): void => {
      if (this.#motion !== m) return;
      m.t += Math.min(now - m.last, 64);
      m.last = now;
      if (step(m.t)) {
        this.#motion = undefined;
        this.#target = null;
        this.#draw();
        if (done) done();
        else this.#settled();
        return;
      }
      m.raf = requestAnimationFrame(tick);
    };
    m.raf = requestAnimationFrame(tick);
  }

  /** @private `SnapFlingBehavior.animateWithTarget`: spring over `distance`, optionally never past it. */
  #springBy(distance: number, velocity: number, spec: CarouselSpring = this.#snapSpring(), done?: () => void): void {
    if (Math.abs(distance) < 0.01 || prefersReducedMotion()) {
      this.#stop();
      this.#scrollBy(distance);
      if (done) done();
      else this.#settled();
      return;
    }
    const target = this.#pos + distance;
    let consumed = 0;
    this.#run((ms) => {
      const st = springSolve(-distance, velocity, spec.k, spec.z, ms / 1000);
      let value = distance + st.x;
      const raw = value;
      if (spec.coerce) value = distance > 0 ? Math.min(value, distance) : Math.max(value, distance);
      const d = value - consumed;
      const used = this.#scrollBy(d);
      consumed += used;
      if (Math.abs(st.x) < 0.5 && Math.abs(st.v) < 5) {
        this.#scrollBy(distance - consumed);
        return true;
      }
      return (spec.coerce && raw !== value) || Math.abs(d - used) > 0.5;
    }, done);
    this.#target = target;
  }

  /** @private */ #springTo(target: number, velocity: number, spec?: CarouselSpring): void {
    this.#springBy(target - this.#pos, velocity, spec);
  }

  /** @private */ #snapSpring(): CarouselSpring {
    return this.motion === "expressive" ? EXPRESSIVE_SNAP_SPRING : STANDARD_SNAP_SPRING;
  }

  /** @private `noSnapFlingBehavior`: spline decay that stops when the content stops moving. */
  #decay(velocity: number): void {
    if (!velocity || prefersReducedMotion()) return this.#settled();
    const decay = new FlingDecay();
    const duration = decay.info(velocity).duration;
    let consumed = 0;
    this.#run((ms) => {
      const e = Math.min(ms, duration);
      const st = decay.sample(e, velocity);
      const d = st.position - consumed;
      const used = this.#scrollBy(d);
      consumed += used;
      return e >= duration || Math.abs(d - used) > 0.5;
    });
  }

  /** @private Pages intersecting the viewport, with their offsets. */
  #visiblePages(): { i: number; o: number }[] {
    const out: { i: number; o: number }[] = [];
    const stride = this.#page + this.#strategy.itemSpacing;
    for (let i = 0; i < this.#items.length; i++) {
      const o = i * stride - this.#pos;
      if (o + this.#page > 0 && o < this.#size) out.push({ i, o });
    }
    return out;
  }

  /** @private `PagerSnapLayoutInfoProvider.calculateSnapOffset` + `calculateFinalSnappingBound`. */
  #snapOffset(velocity: number, dragDistance: number): number {
    let lower = -Infinity;
    let upper = Infinity;
    for (const p of this.#visiblePages()) {
      const o = p.o - getSnapPositionOffset(this.#strategy, p.i, this.#items.length);
      if (o <= 0 && o > lower) lower = o;
      if (o >= 0 && o < upper) upper = o;
    }
    if (lower === -Infinity) lower = upper;
    if (upper === Infinity) upper = lower;
    const notGesture = Math.trunc(dragDistance) === 0;
    const forward = !((notGesture ? -velocity : dragDistance) > 0);
    if (this.#pos >= this.#max) {
      upper = 0;
      if (forward) lower = 0;
    }
    if (this.#pos <= 0) {
      lower = 0;
      if (!forward) upper = 0;
    }
    const page = this.#page;
    const offset = page ? dragDistance / page : 0;
    const overflow = offset - Math.trunc(offset);
    let result: number;
    if (Math.abs(velocity) < MIN_FLING_VELOCITY) {
      if (Math.abs(overflow) > SNAP_POSITIONAL_THRESHOLD) result = forward ? upper : lower;
      else if (Math.abs(offset) >= Math.min(POSITION_THRESHOLD, page / 2) / page) result = forward ? lower : upper;
      else result = Math.abs(lower) < Math.abs(upper) ? lower : upper;
    } else result = velocity > 0 ? upper : lower;
    return Number.isFinite(result) ? result : 0;
  }

  /** @private `multiBrowseFlingBehavior`: decay (or spring) to one page before the target, then snap. */
  #multiFling(velocity: number, dragDistance: number): void {
    const decay = new FlingDecay();
    const decayOffset = decay.target(velocity);
    const stride = this.#page + this.#strategy.itemSpacing;
    const first = this.#visiblePages()[0]?.i ?? 0;
    const startPage = velocity < 0 ? first + 1 : first;
    const target = Math.min(Math.max(startPage + Math.trunc(fr(decayOffset / stride)), 0), this.#items.length);
    const approach = Math.max(Math.abs((target - startPage) * stride) - stride, 0) * Math.sign(velocity);
    const snap = (v: number): void => this.#springBy(this.#snapOffset(v, dragDistance), v);
    if (!approach || !velocity || prefersReducedMotion()) return snap(velocity);
    let consumed = 0;
    if (Math.abs(decayOffset) >= Math.abs(approach)) {
      const duration = decay.info(velocity).duration;
      this.#run(
        (ms) => {
          const e = Math.min(ms, duration);
          const st = decay.sample(e, velocity);
          let value = st.position;
          let stop = e >= duration;
          if (Math.abs(value) >= Math.abs(approach)) {
            value = approach > 0 ? Math.min(value, approach) : Math.max(value, approach);
            stop = true;
          }
          const d = value - consumed;
          const used = this.#scrollBy(d);
          consumed = value;
          if (Math.abs(d - used) > 0.5) stop = true;
          if (stop) this.#flingVelocity = st.velocity;
          return stop;
        },
        () => snap(this.#flingVelocity),
      );
    } else this.#springBy(approach, velocity, STANDARD_SNAP_SPRING, () => snap(0));
  }

  /** @private Release with `velocity` (scroll px/s) after dragging `dragDistance` px (pointer delta). */
  #fling(velocity: number, dragDistance: number): void {
    const clamped = Math.min(Math.max(this.#pos, 0), this.#max);
    if (clamped !== this.#pos) {
      // release from the overscroll stretch
      this.#target = clamped;
      const from = this.#pos;
      this.#run((ms) => {
        const st = springSolve(from - clamped, 0, STANDARD_SNAP_SPRING.k, 1, ms / 1000);
        this.#pos = clamped + st.x;
        this.#draw();
        if (Math.abs(st.x) < 0.5) {
          this.#pos = clamped;
          return true;
        }
        return false;
      });
      return;
    }
    const mode = this.#snapMode();
    if (!mode) return this.#decay(velocity);
    if (mode === "multi") return this.#multiFling(velocity, dragDistance);
    this.#springBy(this.#snapOffset(velocity, dragDistance), velocity); // singleAdvance (atMost(1))
  }

  /** @private */ #settled(): void {
    this.dispatchEvent(new CustomEvent("settle", { detail: { index: this.activeIndex }, bubbles: true, composed: true }));
  }

  // ── input ─────────────────────────────────────────────────────────────────────────────────────

  /** @private Main-axis pointer coordinate, in scroll direction (RTL flips it). */
  #main(e: PointerEvent): number {
    if (this.vertical) return e.clientY;
    return this.#rtl ? -e.clientX : e.clientX;
  }

  /** @private */ #cross(e: PointerEvent): number {
    return this.vertical ? e.clientX : e.clientY;
  }

  /** @private */ #onPointerDown(e: PointerEvent): void {
    if (!this.userScrollEnabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    this.#stop(); // a touch on a moving carousel stops it
    const tracker = new VelocityTracker();
    tracker.down(e.timeStamp, this.#main(e));
    this.#drag = {
      id: e.pointerId,
      start: this.#main(e),
      startCross: this.#cross(e),
      last: this.#main(e),
      moved: false,
      slop: touchSlop(e.pointerType),
      tracker,
    };
    this.#suppressClick = false;
  }

  /** @private */ #onPointerMove(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || d.id !== e.pointerId) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const c of events.length ? events : [e]) d.tracker.move(c.timeStamp, this.#main(c));
    if (!d.moved) {
      const dm = this.#main(e) - d.start;
      const dc = this.#cross(e) - d.startCross;
      if (Math.abs(dm) <= d.slop) return;
      if (Math.abs(dc) > Math.abs(dm)) {
        this.#drag = undefined; // the page scrolls instead
        return;
      }
      d.moved = true;
      d.last = d.start + Math.sign(dm) * d.slop;
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    e.preventDefault();
    let delta = d.last - this.#main(e);
    d.last = this.#main(e);
    const clamped = Math.min(Math.max(this.#pos, 0), this.#max);
    if (this.#pos !== clamped || this.#pos + delta < 0 || this.#pos + delta > this.#max) {
      // overscroll: what still fits moves normally, the rest stretches with growing resistance
      const inside =
        this.#pos + delta < 0 ? -this.#pos : this.#pos + delta > this.#max ? this.#max - this.#pos : delta;
      const accepted = this.#pos >= 0 && this.#pos <= this.#max ? inside : 0;
      this.#pos += accepted;
      delta -= accepted;
      const over = Math.abs(this.#pos - Math.min(Math.max(this.#pos, 0), this.#max));
      delta *= 0.45 * Math.max(0.05, 1 - over / (this.#size * 0.6));
    }
    this.#pos += delta;
    this.#requestDraw();
  }

  /** @private */ #onPointerUp(e: PointerEvent, cancel: boolean): void {
    const d = this.#drag;
    if (!d || d.id !== e.pointerId) return;
    this.#drag = undefined;
    if (!d.moved) return;
    this.#suppressClick = !cancel;
    try {
      this.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const pointerVelocity = cancel ? 0 : d.tracker.up(e.timeStamp, MAX_FLING_VELOCITY);
    if (this.#renderQueued) {
      cancelAnimationFrame(this.#renderQueued);
      this.#renderQueued = 0;
      this.#draw();
    }
    this.#fling(-pointerVelocity, (cancel ? d.last : this.#main(e)) - d.start);
    setTimeout(() => (this.#suppressClick = false), 0);
  }

  /** @private */ #onWheel(e: WheelEvent): void {
    if (!this.userScrollEnabled || !this.#strategy.isValid) return;
    const v = this.vertical;
    let d = v ? e.deltaY : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!d) return;
    if (this.#rtl) d = -d;
    const mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.#size : 1;
    const next = this.#pos + d * mul;
    // let the page scroll once the carousel is at its end in that direction
    if ((next < 0 && this.#pos <= 0) || (next > this.#max && this.#pos >= this.#max)) return;
    e.preventDefault();
    if (this.#snapMode() === "page" && v && Math.abs(d * mul) >= 50) {
      // a mouse-wheel notch on a vertical pager turns one page
      if (this.#wheelLock) return;
      this.#wheelLock = true;
      setTimeout(() => (this.#wheelLock = false), 350);
      const i = this.#stopIndex(this.#target ?? this.#pos) + Math.sign(d);
      this.#springTo(this.#stops[Math.max(0, Math.min(this.#stops.length - 1, i))], 0, SCROLL_SPRING);
      return;
    }
    this.#stop();
    this.#scrollBy(d * mul);
    clearTimeout(this.#wheelTimer);
    this.#wheelTimer = window.setTimeout(() => (this.#snapMode() ? this.#fling(0, 0) : this.#settled()), 100);
  }

  /** @private */ #onKeyDown(e: KeyboardEvent): void {
    if (!this.userScrollEnabled || e.target !== this) return;
    const v = this.vertical;
    const forward = v ? "ArrowDown" : this.#rtl ? "ArrowLeft" : "ArrowRight";
    const back = v ? "ArrowUp" : this.#rtl ? "ArrowRight" : "ArrowLeft";
    if (![forward, back, "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const base = this.#target ?? this.#pos;
    if (!this.#snapMode()) {
      const step = this.#page + this.#strategy.itemSpacing;
      const to = e.key === forward ? base + step : e.key === back ? base - step : e.key === "Home" ? 0 : this.#max;
      this.#springTo(Math.min(Math.max(to, 0), this.#max), 0, SCROLL_SPRING);
      return;
    }
    let i = this.#stopIndex(base);
    if (e.key === forward) i++;
    else if (e.key === back) i--;
    else if (e.key === "Home") i = 0;
    else i = this.#stops.length - 1;
    this.#springTo(this.#stops[Math.max(0, Math.min(this.#stops.length - 1, i))], 0, SCROLL_SPRING);
  }

  /** @internal Snapshot for tests. */
  get _debugState(): { pos: number; max: number; active: number; dragging: boolean; animating: boolean } {
    return { pos: this.#pos, max: this.#max, active: this.activeIndex, dragging: !!this.#drag?.moved, animating: !!this.#motion };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-carousel": M3eCarouselElement;
  }
}
