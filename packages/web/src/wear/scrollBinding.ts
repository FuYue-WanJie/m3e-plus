/** Scroll metrics of a bound scroll container. */
export interface ScrollMetrics {
  /** scrollTop in px. */
  offset: number;
  /** Total scrollable distance (scrollHeight - clientHeight), 0 when the content fits. */
  range: number;
  /** clientHeight / scrollHeight in (0, 1]. */
  viewportFraction: number;
  /**
   * Distance in px from the bottom of the last child to the bottom of the viewport (negative while
   * the last child is still below the fold) — AndroidX `ScrollInfoProvider.lastItemOffset`.
   */
  lastItemOffset: number;
}

/**
 * Binds a host element to a scroll container, resolved from an element reference or an id
 * (looked up in the host's root, like `<label for>`). Calls `onChange` on scroll and on resize
 * of the container or its content.
 */
export class ScrollBinding {
  #host: Element;
  #onChange: (m: ScrollMetrics) => void;
  #target: HTMLElement | null = null;
  #ro?: ResizeObserver;
  #mo?: MutationObserver;
  #raf = 0;

  constructor(host: Element, onChange: (m: ScrollMetrics) => void) {
    this.#host = host;
    this.#onChange = onChange;
  }

  get target(): HTMLElement | null {
    return this.#target;
  }

  /** Re-resolves the target. Pass an element, an id, or null to unbind. */
  bind(ref: HTMLElement | string | null | undefined): void {
    let el: HTMLElement | null = null;
    if (typeof ref === "string" && ref) {
      const root = this.#host.getRootNode() as Document | ShadowRoot;
      el = (root.getElementById?.(ref) as HTMLElement | null) ?? document.getElementById(ref);
    } else if (ref instanceof HTMLElement) {
      el = ref;
    }
    if (el === this.#target) return;
    this.unbind();
    this.#target = el;
    if (!el) return;
    el.addEventListener("scroll", this.#schedule, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      this.#ro = new ResizeObserver(this.#schedule);
      this.#ro.observe(el);
      for (const child of Array.from(el.children)) this.#ro.observe(child);
    }
    if (typeof MutationObserver !== "undefined") {
      // New/removed children change scrollHeight; keep observing their size too.
      this.#mo = new MutationObserver((records) => {
        for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && this.#ro?.observe(n));
        this.#schedule();
      });
      this.#mo.observe(el, { childList: true });
    }
    this.#emit();
  }

  unbind(): void {
    this.#target?.removeEventListener("scroll", this.#schedule);
    this.#ro?.disconnect();
    this.#mo?.disconnect();
    this.#ro = this.#mo = undefined;
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#target = null;
  }

  /** Coalesce to one update per frame. */
  #schedule = (): void => {
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      this.#emit();
    });
  };

  #emit(): void {
    const el = this.#target;
    if (!el) return;
    const range = Math.max(0, el.scrollHeight - el.clientHeight);
    // Use the last child's layout box (offsetTop), not its rect, so visual transforms on items
    // (e.g. m3e-wear-transforming-list) don't feed back into the edge button.
    const last = el.lastElementChild as HTMLElement | null;
    let lastItemOffset = el.clientHeight;
    if (last) {
      const lastTop =
        last.offsetParent === el ? last.offsetTop : last.offsetTop - el.offsetTop - el.clientTop;
      lastItemOffset = el.clientHeight - (lastTop + last.offsetHeight - el.scrollTop);
    }
    this.#onChange({
      lastItemOffset,
      offset: Math.min(range, Math.max(0, el.scrollTop)),
      range,
      viewportFraction: el.scrollHeight > 0 ? Math.min(1, el.clientHeight / el.scrollHeight) : 1,
    });
  }
}
