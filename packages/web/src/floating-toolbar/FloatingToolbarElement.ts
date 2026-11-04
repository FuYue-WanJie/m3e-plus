import { css, CSSResultGroup, html, LitElement, PropertyValues, unsafeCSS } from "lit";
import { property, query, state } from "lit/decorators.js";

import { customElement, DesignToken } from "@wanjie/m3e-web/core";
import { SpringSimulation } from "@wanjie/m3e-web/physics";

/**
 * A floating toolbar — a pill-shaped container that floats above content and displays a row (or
 * column) of actions. Ported from AndroidX Material3 Expressive `FloatingToolbar.kt`.
 *
 * Two compositions:
 * 1. Plain (default): optional `leading` / `trailing` slots expand and collapse with a spring
 *    width animation while the default content stays visible.
 * 2. With a FAB (a `slot="fab"` child): the toolbar's width animates from 0 to its intrinsic
 *    width and the FAB resizes between 56px and 80px based on the expansion progress.
 *
 * Scroll reactions:
 * - `scroll-behavior="exit-always"`: the whole toolbar slides off-screen (towards
 *   `exit-direction`) as the nearest scrollable ancestor scrolls, and settles to an edge when
 *   scrolling stops (collapsedFraction >= 0.5 collapses, else expands).
 * - `thresholds`: the `expanded` attribute flips automatically when the scrollable ancestor
 *   scrolls 40px (configurable) in one direction.
 *
 * @tag m3e-floating-toolbar
 *
 * @attr expanded - Whether the toolbar is expanded (shows leading/trailing content, full width, big FAB).
 * @attr variant - `standard` (default) or `vibrant`.
 * @attr vertical - Lay out contents vertically.
 * @attr fab-position - `end` (default) or `start` (horizontal) / `bottom` (default) or `top` (vertical).
 * @attr scroll-behavior - `exit-always` or `thresholds`; empty disables scroll reactions.
 * @attr exit-direction - `bottom` (default), `top`, `start`, `end`.
 * @attr scroll-threshold - Scroll distance in px that triggers a thresholds flip (default 40).
 *
 * @slot - The main toolbar content (icon buttons).
 * @slot leading - Content shown before the main content when expanded.
 * @slot trailing - Content shown after the main content when expanded.
 * @slot fab - A floating action button (typically `<m3e-fab>`); enables the FAB composition.
 *
 * @cssprop --m3e-floating-toolbar-container-size - Toolbar height (horizontal) or width (vertical). Default 64px.
 * @cssprop --m3e-floating-toolbar-content-padding - Content padding. Default 8px.
 * @cssprop --m3e-floating-toolbar-screen-offset - Distance from the screen edge. Default 16px.
 * @cssprop --m3e-floating-toolbar-shape - Container border radius. Default full pill.
 * @cssprop --m3e-floating-toolbar-toolbar-container-color - Toolbar container color.
 * @cssprop --m3e-floating-toolbar-toolbar-content-color - Toolbar content color.
 * @cssprop --m3e-floating-toolbar-fab-container-color - FAB container color (the fab slot content may ignore it).
 * @cssprop --m3e-floating-toolbar-fab-content-color - FAB content color.
 * @cssprop --m3e-floating-toolbar-expanded-elevation - Shadow when expanded (with fab default level1).
 * @cssprop --m3e-floating-toolbar-collapsed-elevation - Shadow when collapsed (default level0).
 */
@customElement("m3e-floating-toolbar")
export class M3eFloatingToolbarElement extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      /* Floating layout: position it with normal CSS (absolute/fixed) in the host page. */
      position: relative;
      max-width: fit-content;
    }
    :host([hidden]) {
      display: none;
    }
    .root {
      position: relative;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      height: var(--m3e-floating-toolbar-container-size, 64px);
      padding: var(--m3e-floating-toolbar-content-padding, 8px);
      border-radius: var(--m3e-floating-toolbar-shape, 9999px);
      background-color: var(
        --m3e-floating-toolbar-toolbar-container-color,
        var(--_toolbar-container-color)
      );
      color: var(--m3e-floating-toolbar-toolbar-content-color, var(--_toolbar-content-color));
      box-shadow: var(--_elevation, ${unsafeCSS(DesignToken.elevation.level0)});
      transition: box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host([vertical]) .root {
      flex-direction: column;
      height: auto;
      width: var(--m3e-floating-toolbar-container-size, 64px);
    }
    .leading,
    .trailing {
      display: flex;
      align-items: center;
      overflow: hidden;
      flex: none;
      justify-content: flex-end;
    }
    :host([vertical]) .leading,
    :host([vertical]) .trailing {
      flex-direction: column;
      justify-content: flex-end;
    }
    .trailing {
      justify-content: flex-start;
    }
    .content {
      display: flex;
      align-items: center;
      gap: 4px; /* ContainerBetweenSpace */
      overflow: hidden;
      min-width: 0;
    }
    :host([vertical]) .content {
      flex-direction: column;
    }
    /* Content padding keeps edge buttons' touch targets balanced while collapsed. */
    .content.pad-leading {
      padding-inline-start: 8px;
    }
    .content.pad-trailing {
      padding-inline-end: 8px;
    }
    .fab-slot {
      position: absolute;
      inset-inline-end: calc(-1 * var(--fab-size) - 8px); /* ToolbarToFabGap */
      top: 50%;
      translate: 0 -50%;
      width: var(--fab-size, 56px);
      height: var(--fab-size, 56px);
      contain: layout;
    }
    :host([fab-position="start"]) .fab-slot {
      inset-inline-end: auto;
      inset-inline-start: calc(-1 * var(--fab-size) - 8px);
    }
    .fab-slot ::slotted(*) {
      width: 100% !important;
      height: 100% !important;
    }
    :host([vertical]) .fab-slot {
      inset-inline-end: auto;
      inset-inline-start: 50%;
      top: calc(100% + 8px);
      bottom: auto;
      translate: -50% 0;
    }
    :host([vertical][fab-position="top"]) .fab-slot {
      top: auto;
      bottom: calc(100% + 8px);
    }
    ::slotted(*) {
      flex: none;
    }
    /* Variant colors (AndroidX standard/vibrant). */
    :host {
      --_toolbar-container-color: var(--m3e-color-surface-container, ${unsafeCSS(DesignToken.color.surfaceContainer)});
      --_toolbar-content-color: var(--m3e-color-on-surface, ${unsafeCSS(DesignToken.color.onSurface)});
      --_fab-container-color: var(--m3e-color-primary-container, ${unsafeCSS(DesignToken.color.primaryContainer)});
      --_fab-content-color: var(--m3e-color-on-primary-container, ${unsafeCSS(DesignToken.color.onPrimaryContainer)});
    }
    :host([variant="vibrant"]) {
      --_toolbar-container-color: var(--m3e-color-primary-container, ${unsafeCSS(DesignToken.color.primaryContainer)});
      --_toolbar-content-color: var(--m3e-color-on-primary-container, ${unsafeCSS(DesignToken.color.onPrimaryContainer)});
      --_fab-container-color: var(--m3e-color-tertiary-container, ${unsafeCSS(DesignToken.color.tertiaryContainer)});
      --_fab-content-color: var(--m3e-color-on-tertiary-container, ${unsafeCSS(DesignToken.color.onTertiaryContainer)});
    }
    @media (prefers-reduced-motion) {
      .root,
      .leading,
      .trailing,
      .fab-slot {
        transition: none !important;
      }
    }
  `;

  /** Whether the toolbar is expanded. @default false */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** The appearance variant. @default "standard" */
  @property({ reflect: true, useDefault: true }) variant: "standard" | "vibrant" = "standard";

  /** Whether the toolbar is oriented vertically. @default false */
  @property({ type: Boolean, reflect: true }) vertical = false;

  /** The position of the adjacent FAB. @default "end" */
  @property({ attribute: "fab-position", reflect: true, useDefault: true })
  fabPosition: "end" | "start" | "bottom" | "top" = "end";

  /**
   * How the toolbar reacts to ancestor scrolling: `exit-always` slides it off-screen, `thresholds`
   * flips `expanded` based on scroll direction; empty disables.
   * @default ""
   */
  @property({ attribute: "scroll-behavior", reflect: true }) scrollBehavior: "" | "exit-always" | "thresholds" = "";

  /** The direction the toolbar exits towards (exit-always only). @default "bottom" */
  @property({ attribute: "exit-direction", reflect: true, useDefault: true })
  exitDirection: "bottom" | "top" | "start" | "end" = "bottom";

  /** Scroll distance (px) that flips `expanded` in thresholds mode. @default 40 */
  @property({ attribute: "scroll-threshold", type: Number }) scrollThreshold = 40;

  /** @private */ @query(".root") private readonly _root!: HTMLElement;
  /** @private */ @query(".leading") private readonly _leading!: HTMLElement;
  /** @private */ @query(".trailing") private readonly _trailing!: HTMLElement;
  /** @private */ @query(".fab-slot") private readonly _fabSlot!: HTMLElement;
  /** @private */ @query(".content") private readonly _content!: HTMLElement;

  /** @private */ @state() private _hasFab = false;
  /** @private */ @state() private _hasLeading = false;
  /** @private */ @state() private _hasTrailing = false;

  // Expressive FastSpatial spring (800/0.6) drives the expansion progress; matches AndroidX.
  /** @private */ readonly #expandSpring = new SpringSimulation({ stiffness: 800, dampingRatio: 0.6 });
  // DefaultEffects spring (1600/1.0) settles the exit offset; matches AndroidX snapAnimationSpec.
  /** @private */ readonly #settleSpring = new SpringSimulation({ stiffness: 1600, dampingRatio: 1.0 });

  /** @private */ #exitOffset = 0;       // px, 0 = fully on-screen; negative = slid out
  /** @private */ #exitLimit = 0;       // px, how far the toolbar can slide out
  /** @private */ #scrollAccum = 0;     // thresholds-mode accumulator
  /** @private */ #scrollTarget: HTMLElement | null = null;
  /** @private */ #raf = 0;
  /** @private */ #prevScroll: number | null = null;   // last scroller offset for delta computation
  /** @private */ #settleTimer: number | null = null;

  /** @inheritdoc */
  protected override firstUpdated(): void {
    this.#updateSlots();
    this.#applyProgress(this.expanded ? 1 : 0);
    if (this.scrollBehavior) this.#bindScroll();
  }

  /** @inheritdoc */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("expanded")) {
      this.#expandSpring.start(this.expanded ? 1 : 0, (f) => this.#applyProgress(f.value));
    }
    if (changed.has("scrollBehavior") || changed.has("exitDirection")) {
      this.#unbindScroll();
      if (this.scrollBehavior) this.#bindScroll();
    }
  }

  /** @inheritdoc */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unbindScroll();
    cancelAnimationFrame(this.#raf);
    this.#expandSpring.stop();
    this.#settleSpring.stop();
  }

  /** @private */
  #updateSlots(): void {
    const check = (name: string): boolean =>
      (this.shadowRoot?.querySelector(`slot[name="${name}"]`) as HTMLSlotElement | undefined)
        ?.assignedElements({ flatten: true }).length! > 0;
    const hasFab = check("fab");
    if (hasFab !== this._hasFab) this._hasFab = hasFab;
    this._hasLeading = check("leading");
    this._hasTrailing = check("trailing");
  }

  /** Expansion progress application (0 = collapsed, 1 = expanded). @private */
  #applyProgress(p: number): void {
    const root = this._root;
    if (!root) return;
    // Clamp tiny negatives from spring overshoot handling.
    const v = Math.max(0, Math.min(1, p));

    if (this._hasFab) {
      // FAB composition: toolbar width 0 -> intrinsic; FAB 56 -> 80.
      const fabSize = 56 + 24 * v;
      this._fabSlot.style.setProperty("--fab-size", `${fabSize}px`);
      this._fabSlot.style.opacity = "1";
      const max = this.#maxToolbarSize();
      const size = max * v;
      if (this.vertical) {
        this._content.style.height = `${size}px`;
        this._content.style.width = "";
      } else {
        this._content.style.width = `${size}px`;
        this._content.style.height = "";
      }
      this._content.style.overflow = "hidden";
      root.style.setProperty(
        "--_elevation",
        v > 0.5 ? DesignToken.elevation.level1.toString() : DesignToken.elevation.level0.toString(),
      );
    } else {
      // Plain composition: leading/trailing animate their size; content always visible.
      const animateSide = (el: HTMLElement, expandedSide: boolean): void => {
        if (!el) return;
        const max = this.#sideIntrinsicSize(el);
        const visible = expandedSide ? v : 1 - v;
        const size = Math.max(0, max * visible);
        if (this.vertical) {
          el.style.height = `${size}px`;
          el.style.width = "";
        } else {
          el.style.width = `${size}px`;
          el.style.height = "";
        }
        el.style.opacity = visible > 0.15 ? "1" : "0";
      };
      // AndroidX: leading expands from Start (its own edge), trailing from End.
      animateSide(this._leading, true);
      animateSide(this._trailing, false);
      // Balanced padding: remove the edge padding when its side is collapsed.
      this._content.classList.toggle("pad-leading", !(this._hasLeading && v > 0.5));
      this._content.classList.toggle("pad-trailing", !(this._hasTrailing && v > 0.5));
    }
  }

  /** Intrinsic size (width for horizontal, height for vertical) of an element's content. @private */
  #sideIntrinsicSize(el: HTMLElement): number {
    // Measure natural size by momentarily clearing inline constraints (cheap enough at 60fps only
    // when values change; cache instead).
    const cache = (el as HTMLElement & { _intrinsic?: number })._intrinsic;
    if (cache != null) return cache;
    const prevW = el.style.width, prevH = el.style.height;
    el.style.width = ""; el.style.height = "";
    const size = this.vertical ? el.scrollHeight : el.scrollWidth;
    el.style.width = prevW; el.style.height = prevH;
    (el as HTMLElement & { _intrinsic?: number })._intrinsic = size;
    return size;
  }

  /** Intrinsic content size of the toolbar (max content width). @private */
  #maxToolbarSize(): number {
    const cache = (this._content as HTMLElement & { _intrinsic?: number })._intrinsic;
    if (cache != null) return cache;
    const prevW = this._content.style.width, prevH = this._content.style.height;
    this._content.style.width = ""; this._content.style.height = "";
    const size = this.vertical ? this._content.scrollHeight : this._content.scrollWidth;
    this._content.style.width = prevW; this._content.style.height = prevH;
    (this._content as HTMLElement & { _intrinsic?: number })._intrinsic = size;
    return size;
  }

  /** @private Find nearest scrollable ancestor. */
  #findScroller(): HTMLElement | null {
    let el = this.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(style.overflowY) || /(auto|scroll)/.test(style.overflowX);
      if (scrollable && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) return el;
      el = el.parentElement;
    }
    return document.scrollingElement as HTMLElement ?? document.documentElement;
  }

  /** @private */
  #bindScroll(): void {
    this.#scrollTarget = this.#findScroller();
    if (!this.#scrollTarget) return;
    this.#prevScroll = null;
    this.#scrollTarget.addEventListener("scroll", this.#onScroll, { passive: true });
    this.#measureExitLimit();
  }

  /** @private */
  #unbindScroll(): void {
    if (this.#scrollTarget) {
      this.#scrollTarget.removeEventListener("scroll", this.#onScroll);
      this.#scrollTarget = null;
    }
  }

  /** @private */
  readonly #onScroll = (): void => {
    const t = this.#scrollTarget!;
    if (this.scrollBehavior === "exit-always") {
      // AndroidX uses the consumed scroll delta of the content under the toolbar; here we use
      // the scroller's total offset change. First event establishes the baseline (delta 0).
      const axis = this.exitDirection === "start" || this.exitDirection === "end" ? "scrollLeft" : "scrollTop";
      const current = t[axis];
      const delta = this.#prevScroll === null ? 0 : current - this.#prevScroll;
      this.#prevScroll = current;
      // Scrolling "down" (delta > 0) collapses (slides out); scrolling up restores.
      this.#exitOffset = Math.max(this.#exitLimit, Math.min(0, this.#exitOffset - Math.abs(delta) * Math.sign(delta || 1)));
      cancelAnimationFrame(this.#raf);
      this.#raf = requestAnimationFrame(() => this.#applyExitOffset());
      // Debounced settle when scrolling stops.
      if (this.#settleTimer !== null) clearTimeout(this.#settleTimer);
      this.#settleTimer = setTimeout(() => this.#settle(), 120) as unknown as number;
    } else if (this.scrollBehavior === "thresholds") {
      // Track the scroller axis the exit direction points along (same rule as exit-always).
      const axis = this.exitDirection === "start" || this.exitDirection === "end" ? "scrollLeft" : "scrollTop";
      const current = t[axis];
      const delta = this.#prevScroll === null ? 0 : current - this.#prevScroll;
      this.#prevScroll = current;
      this.#scrollAccum += delta;
      if (this.#scrollAccum >= this.scrollThreshold && !this.expanded) {
        this.expanded = true;
        this.#scrollAccum = 0;
      } else if (this.#scrollAccum <= -this.scrollThreshold && this.expanded) {
        this.expanded = false;
        this.#scrollAccum = 0;
      }
    }
  };

  /** Compute how far the toolbar must slide to fully exit via exitDirection. @private */
  #measureExitLimit(): void {
    const rect = this.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    switch (this.exitDirection) {
      case "top": this.#exitLimit = -(rect.bottom); break;
      case "bottom": this.#exitLimit = -(vh - rect.top); break;
      case "start": this.#exitLimit = -(rect.right); break;
      case "end": this.#exitLimit = -(vw - rect.left); break;
    }
  }

  /** Spring-settle to the nearest edge (AndroidX settleFloatingToolbar). @private */
  #settle(): void {
    const fraction = this.#exitLimit !== 0 ? this.#exitOffset / this.#exitLimit : 0;
    const target = fraction >= 0.5 ? this.#exitLimit : 0;
    this.#settleSpring.start(target, (f) => {
      this.#exitOffset = f.value;
      this.#applyExitOffset();
    });
  }

  /** @private */
  #applyExitOffset(): void {
    const dir = this.exitDirection;
    const off = this.#exitOffset;
    const t = dir === "top" || dir === "bottom" ? `translateY(${off}px)` : `translateX(${off}px)`;
    this._root.style.transform = off !== 0 ? t : "";
    // Offscreen toolbars are not focusable (AndroidX canFocus = false).
    this._root.style.visibility = Math.abs(off) > Math.abs(this.#exitLimit) - 8 ? "hidden" : "";
  }

  /** @inheritdoc */
  protected override render(): unknown {
    return html`
      <div class="root" part="root" aria-expanded=${this.expanded ? "true" : "false"}>
        <div class="leading" part="leading" ?hidden=${!this._hasLeading}>
          <slot name="leading" @slotchange=${this.#updateSlots}></slot>
        </div>
        <div class="content" part="content">
          <slot @slotchange=${() => { this.#invalidateIntrinsic(); this.#updateSlots(); }}></slot>
        </div>
        <div class="trailing" part="trailing" ?hidden=${!this._hasTrailing}>
          <slot name="trailing" @slotchange=${this.#updateSlots}></slot>
        </div>
        <div class="fab-slot" part="fab" ?hidden=${!this._hasFab}>
          <slot name="fab" @slotchange=${this.#updateSlots}></slot>
        </div>
      </div>
    `;
  }

  /** @private */
  #invalidateIntrinsic(): void {
    delete (this._content as HTMLElement & { _intrinsic?: number })?._intrinsic;
    delete (this._leading as HTMLElement & { _intrinsic?: number })?._intrinsic;
    delete (this._trailing as HTMLElement & { _intrinsic?: number })?._intrinsic;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3e-floating-toolbar": M3eFloatingToolbarElement;
  }
}
