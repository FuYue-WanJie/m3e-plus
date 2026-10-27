/**
 * Carousel keyline layout engine — pure functions porting the AndroidX Material3 Expressive
 * carousel keyline math (`compose/material3/carousel/Keylines.kt`, `KeylineList.kt`,
 * `Arrangement.kt`).
 *
 * A carousel lays out one screenful of items as a `KeylineList`: each item is a "keyline" with a
 * main-axis `size` and a centre `offset`, tagged `isFocal`/`isAnchor`/`isPivot` and a `cutoff`
 * fraction. Three strategies (multi-browse, uncontained, hero) differ only in how they choose the
 * large/medium/small counts and sizes. Scrolling interpolates between successive keyline lists.
 *
 * Float arithmetic: the source uses Kotlin `Float` (32-bit); we mirror that with `Math.fround` so
 * values match the reference implementation bit-for-bit (validated against a Kotlin oracle).
 */

/** 32-bit float rounding, mirroring Kotlin `Float` arithmetic. */
const f = Math.fround;

const FLOAT_MAX = f(3.4028234663852886e38);
const coerceIn = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);
const lerpValue = (start: number, stop: number, fraction: number): number =>
  f(f(f(1 - fraction) * start) + f(fraction * stop));
/** Kotlin `Float.toInt`: truncation, NaN→0, clamped to Int range. */
const toInt = (v: number): number =>
  Number.isNaN(v) ? 0 : Math.trunc(Math.min(Math.max(v, -2147483648), 2147483647));
const half = (v: number): number => f(v / 2);
/**
 * Descending integer range from `maxLargeCount` down to `minLargeCount` (inclusive), guarding against
 * a zero/non-finite `targetLargeSize` (divide-by-zero) that would otherwise allocate a runaway array.
 */
const largeCountRange = (minLargeCount: number, maxLargeCount: number): number[] => {
  const lo = Math.max(1, Math.min(minLargeCount, maxLargeCount));
  const hi = Math.max(lo, Math.min(maxLargeCount, lo + 512));
  const out: number[] = [];
  for (let v = hi; v >= lo; v--) out.push(v);
  return out;
};

/** Array.prototype.findLastIndex equivalent (ES2023; target is ES2021). */
const findLastIdx = <T>(arr: ArrayLike<T>, pred: (t: T) => boolean): number => {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
};

/** Default sizing constants (`CarouselDefaults`). */
export const CarouselDefaults = Object.freeze({
  MinSmallItemSize: 40,
  MaxSmallItemSize: 56,
  ItemSpacing: 0,
  AnchorSize: 10,
  MediumLargeItemDiffThreshold: 0.85,
});

const MediumItemFlexPercentage = f(0.1);

// ── Arrangement ─────────────────────────────────────────────────────────────────────────────────

/** A candidate large/medium/small count+size combination, scored by how close its large size is. */
export class Arrangement {
  constructor(
    readonly priority: number,
    readonly smallSize: number,
    readonly smallCount: number,
    readonly mediumSize: number,
    readonly mediumCount: number,
    readonly largeSize: number,
    readonly largeCount: number,
  ) {}

  isValid(): boolean {
    if (this.largeCount > 0 && this.smallCount > 0 && this.mediumCount > 0) {
      return this.largeSize > this.mediumSize && this.mediumSize > this.smallSize;
    } else if (this.largeCount > 0 && this.smallCount > 0) {
      return this.largeSize > this.smallSize;
    }
    return true;
  }

  cost(targetLargeSize: number): number {
    if (!this.isValid()) return FLOAT_MAX;
    return f(Math.abs(f(targetLargeSize - this.largeSize)) * this.priority);
  }

  itemCount(): number {
    return this.largeCount + this.mediumCount + this.smallCount;
  }

  static findLowestCostArrangement(opts: {
    availableSpace: number;
    itemSpacing: number;
    targetSmallSize: number;
    minSmallSize: number;
    maxSmallSize: number;
    smallCounts: number[];
    targetMediumSize: number;
    mediumCounts: number[];
    targetLargeSize: number;
    largeCounts: number[];
  }): Arrangement | null {
    let lowest: Arrangement | null = null;
    let priority = 1;
    for (const largeCount of opts.largeCounts) {
      for (const mediumCount of opts.mediumCounts) {
        for (const smallCount of opts.smallCounts) {
          const arrangement = fit({
            priority,
            availableSpace: opts.availableSpace,
            itemSpacing: opts.itemSpacing,
            smallCount,
            smallSize: opts.targetSmallSize,
            minSmallSize: opts.minSmallSize,
            maxSmallSize: opts.maxSmallSize,
            mediumCount,
            mediumSize: opts.targetMediumSize,
            largeCount,
            largeSize: opts.targetLargeSize,
          });
          if (lowest === null || arrangement.cost(opts.targetLargeSize) < lowest.cost(opts.targetLargeSize)) {
            lowest = arrangement;
            if (lowest.cost(opts.targetLargeSize) === 0) return lowest;
          }
          priority++;
        }
      }
    }
    return lowest;
  }
}

function fit(p: {
  priority: number;
  availableSpace: number;
  itemSpacing: number;
  smallCount: number;
  smallSize: number;
  minSmallSize: number;
  maxSmallSize: number;
  mediumCount: number;
  mediumSize: number;
  largeCount: number;
  largeSize: number;
}): Arrangement {
  const totalItemCount = p.largeCount + p.mediumCount + p.smallCount;
  const availableSpaceWithoutSpacing = f(p.availableSpace - f((totalItemCount - 1) * p.itemSpacing));
  let arrangedSmallSize = coerceIn(p.smallSize, p.minSmallSize, p.maxSmallSize);
  let arrangedMediumSize = p.mediumSize;
  let arrangedLargeSize = p.largeSize;

  const totalSpaceTaken = f(
    f(f(arrangedLargeSize * p.largeCount) + f(arrangedMediumSize * p.mediumCount)) +
      f(arrangedSmallSize * p.smallCount),
  );
  const delta = f(availableSpaceWithoutSpacing - totalSpaceTaken);
  if (p.smallCount > 0 && delta > 0) {
    arrangedSmallSize = f(arrangedSmallSize + Math.min(f(delta / p.smallCount), f(p.maxSmallSize - arrangedSmallSize)));
  } else if (p.smallCount > 0 && delta < 0) {
    arrangedSmallSize = f(arrangedSmallSize + Math.max(f(delta / p.smallCount), f(p.minSmallSize - arrangedSmallSize)));
  }

  arrangedSmallSize = p.smallCount > 0 ? arrangedSmallSize : 0;
  arrangedLargeSize = calculateLargeSize(availableSpaceWithoutSpacing, p.smallCount, arrangedSmallSize, p.mediumCount, p.largeCount);
  arrangedMediumSize = half(f(arrangedLargeSize + arrangedSmallSize));

  if (p.mediumCount > 0 && arrangedLargeSize !== p.largeSize) {
    const targetAdjustment = f(f(p.largeSize - arrangedLargeSize) * p.largeCount);
    const availableMediumFlex = f(f(arrangedMediumSize * MediumItemFlexPercentage) * p.mediumCount);
    const distribute = Math.min(Math.abs(targetAdjustment), availableMediumFlex);
    if (targetAdjustment > 0) {
      arrangedMediumSize = f(arrangedMediumSize - f(distribute / p.mediumCount));
      arrangedLargeSize = f(arrangedLargeSize + f(distribute / p.largeCount));
    } else {
      arrangedMediumSize = f(arrangedMediumSize + f(distribute / p.mediumCount));
      arrangedLargeSize = f(arrangedLargeSize - f(distribute / p.largeCount));
    }
  }

  return new Arrangement(p.priority, arrangedSmallSize, p.smallCount, arrangedMediumSize, p.mediumCount, arrangedLargeSize, p.largeCount);
}

function calculateLargeSize(availableSpace: number, smallCount: number, smallSize: number, mediumCount: number, largeCount: number): number {
  return f(f(availableSpace - f(f(smallCount + half(mediumCount)) * smallSize)) / f(largeCount + half(mediumCount)));
}

// ── Keyline & KeylineList ───────────────────────────────────────────────────────────────────────

/** One keyline: an item's main-axis size, centre offset, flags and cutoff fraction. */
export interface Keyline {
  size: number;
  offset: number;
  unadjustedOffset: number;
  isFocal: boolean;
  isAnchor: boolean;
  isPivot: boolean;
  cutoff: number;
}

/** A screenful of keylines with derived index accessors. */
export class KeylineList extends Array<Keyline> {
  minSize = 0;
  maxSize = 0;
  pivotIndex = -1;
  firstNonAnchorIndex = -1;
  lastNonAnchorIndex = -1;
  firstFocalIndex = -1;
  lastFocalIndex = -1;
  focalCount = 0;

  static override from(items: Keyline[] | ArrayLike<Keyline>): KeylineList {
    const list = new KeylineList();
    for (let i = 0; i < items.length; i++) list.push(items[i]);
    list.#index();
    return list;
  }

  #index(): void {
    let min = FLOAT_MAX;
    let max = 0;
    for (const k of this) {
      if (k.size < min) min = k.size;
      if (k.size > max) max = k.size;
    }
    this.minSize = min;
    this.maxSize = max;
    this.pivotIndex = this.findIndex((k) => k.isPivot);
    this.firstNonAnchorIndex = this.findIndex((k) => !k.isAnchor);
    this.lastNonAnchorIndex = findLastIdx(this, (k) => !k.isAnchor);
    this.firstFocalIndex = this.findIndex((k) => k.isFocal);
    this.lastFocalIndex = findLastIdx(this, (k) => k.isFocal);
    this.focalCount = this.lastFocalIndex - this.firstFocalIndex + 1;
  }

  get pivot(): Keyline {
    return this[this.pivotIndex];
  }
  get firstNonAnchor(): Keyline {
    return this[this.firstNonAnchorIndex];
  }
  get lastNonAnchor(): Keyline {
    return this[this.lastNonAnchorIndex];
  }
  get firstFocal(): Keyline {
    const k = this[this.firstFocalIndex];
    if (!k) throw new RangeError("KeylineList must have at least one focal keyline");
    return k;
  }
  get lastFocal(): Keyline {
    const k = this[this.lastFocalIndex];
    if (!k) throw new RangeError("KeylineList must have at least one focal keyline");
    return k;
  }

  firstIndexAfterFocalRangeWithSize(size: number): number {
    for (let i = this.lastFocalIndex; i <= this.length - 1; i++) if (this[i].size === size) return i;
    return this.length - 1;
  }
  lastIndexBeforeFocalRangeWithSize(size: number): number {
    for (let i = this.firstFocalIndex - 1; i >= 0; i--) if (this[i].size === size) return i;
    return 0;
  }
  getKeylineBefore(unadjustedOffset: number): Keyline {
    for (let index = this.length - 1; index >= 0; index--) {
      if (this[index].unadjustedOffset < unadjustedOffset) return this[index];
    }
    return this[0];
  }
  getKeylineAfter(unadjustedOffset: number): Keyline {
    return this.find((k) => k.unadjustedOffset >= unadjustedOffset) ?? this[this.length - 1];
  }
  equals(other: KeylineList): boolean {
    if (this === other) return true;
    if (!(other instanceof KeylineList) || this.length !== other.length) return false;
    return this.every((k, i) => keylineEquals(k, other[i]));
  }
}

const keylineEquals = (a: Keyline, b: Keyline): boolean =>
  a.size === b.size &&
  a.offset === b.offset &&
  a.unadjustedOffset === b.unadjustedOffset &&
  a.isFocal === b.isFocal &&
  a.isAnchor === b.isAnchor &&
  a.isPivot === b.isPivot &&
  a.cutoff === b.cutoff;

export const emptyKeylineList = (): KeylineList => KeylineList.from([]);

export const CarouselAlignment = Object.freeze({ Start: -1, Center: 0, End: 1 });

const isFocalIndex = (index: number, firstFocal: number, lastFocal: number): boolean => index >= firstFocal && index <= lastFocal;

class KeylineListScope {
  firstFocalIndex = -1;
  focalItemSize = 0;
  tmp: { size: number; isAnchor: boolean }[] = [];

  add(size: number, isAnchor = false): void {
    this.tmp.push({ size, isAnchor });
    if (!isAnchor && size > this.focalItemSize) {
      this.firstFocalIndex = this.tmp.length - 1;
      this.focalItemSize = size;
    }
  }

  #findLastFocalIndex(): number {
    if (this.firstFocalIndex < 0) return -1;
    let last = this.firstFocalIndex;
    while (last < this.tmp.length - 1 && this.tmp[last + 1].size === this.focalItemSize) last++;
    return last;
  }

  createWithPivot(size: number, itemSpacing: number, pivotIndex: number, pivotOffset: number): KeylineList {
    return KeylineList.from(
      this.#createKeylinesWithPivot(pivotIndex, pivotOffset, this.firstFocalIndex, this.#findLastFocalIndex(), this.focalItemSize, size, itemSpacing),
    );
  }

  createWithAlignment(size: number, itemSpacing: number, alignment: number): KeylineList {
    const lastFocalIndex = this.#findLastFocalIndex();
    const focalItemCount = lastFocalIndex - this.firstFocalIndex;
    const pivotIndex = this.firstFocalIndex;
    let pivotOffset: number;
    if (alignment === CarouselAlignment.Center) {
      const itemSpacingSplit = itemSpacing === 0 || focalItemCount % 2 === 0 ? 0 : half(itemSpacing);
      const itemSpaceCounts = f(Math.trunc(focalItemCount / 2) * itemSpacing);
      pivotOffset = f(f(f(half(size) - f(half(this.focalItemSize) * focalItemCount)) - itemSpacingSplit) - itemSpaceCounts);
    } else if (alignment === CarouselAlignment.End) {
      pivotOffset = f(size - half(this.focalItemSize));
    } else {
      pivotOffset = half(this.focalItemSize);
    }
    return KeylineList.from(this.#createKeylinesWithPivot(pivotIndex, pivotOffset, this.firstFocalIndex, lastFocalIndex, this.focalItemSize, size, itemSpacing));
  }

  #createKeylinesWithPivot(
    pivotIndex: number,
    pivotOffset: number,
    firstFocalIndex: number,
    lastFocalIndex: number,
    itemMainAxisSize: number,
    size: number,
    itemSpacing: number,
  ): Keyline[] {
    const tmp = this.tmp;
    if (!tmp.length || pivotIndex < 0 || pivotIndex >= tmp.length) return [];
    const isCutoffLeft = (s: number, o: number): boolean => f(o - half(s)) < 0 && f(o + half(s)) > 0;
    const isCutoffRight = (s: number, o: number): boolean => f(o - half(s)) < size && f(o + half(s)) > size;
    const pivot = tmp[pivotIndex];
    const keylines: Keyline[] = [];
    const pivotCutoff = isCutoffLeft(pivot.size, pivotOffset)
      ? f(pivotOffset - half(pivot.size))
      : isCutoffRight(pivot.size, pivotOffset)
        ? f(f(pivotOffset + half(pivot.size)) - size)
        : 0;
    keylines.push({
      size: pivot.size,
      offset: pivotOffset,
      unadjustedOffset: pivotOffset,
      isFocal: isFocalIndex(pivotIndex, firstFocalIndex, lastFocalIndex),
      isAnchor: pivot.isAnchor,
      isPivot: true,
      cutoff: pivotCutoff,
    });

    let offset = f(f(pivotOffset - half(itemMainAxisSize)) - itemSpacing);
    let unadj = f(f(pivotOffset - half(itemMainAxisSize)) - itemSpacing);
    for (let oi = pivotIndex - 1; oi >= 0; oi--) {
      const t = tmp[oi];
      const tmpOffset = f(offset - half(t.size));
      const tmpUnadj = f(unadj - half(itemMainAxisSize));
      const cutoff = isCutoffLeft(t.size, tmpOffset) ? Math.abs(f(tmpOffset - half(t.size))) : 0;
      keylines.unshift({
        size: t.size,
        offset: tmpOffset,
        unadjustedOffset: tmpUnadj,
        isFocal: isFocalIndex(oi, firstFocalIndex, lastFocalIndex),
        isAnchor: t.isAnchor,
        isPivot: false,
        cutoff,
      });
      offset = f(offset - f(t.size + itemSpacing));
      unadj = f(unadj - f(itemMainAxisSize + itemSpacing));
    }

    offset = f(f(pivotOffset + half(itemMainAxisSize)) + itemSpacing);
    unadj = f(f(pivotOffset + half(itemMainAxisSize)) + itemSpacing);
    for (let oi = pivotIndex + 1; oi < tmp.length; oi++) {
      const t = tmp[oi];
      const tmpOffset = f(offset + half(t.size));
      const tmpUnadj = f(unadj + half(itemMainAxisSize));
      const cutoff = isCutoffRight(t.size, tmpOffset) ? f(f(tmpOffset + half(t.size)) - size) : 0;
      keylines.push({
        size: t.size,
        offset: tmpOffset,
        unadjustedOffset: tmpUnadj,
        isFocal: isFocalIndex(oi, firstFocalIndex, lastFocalIndex),
        isAnchor: t.isAnchor,
        isPivot: false,
        cutoff,
      });
      offset = f(offset + f(t.size + itemSpacing));
      unadj = f(unadj + f(itemMainAxisSize + itemSpacing));
    }
    return keylines;
  }
}

/** Build a KeylineList with an alignment (`CarouselAlignment.*`) or an explicit pivot. */
export function keylineListOf(
  size: number,
  itemSpacing: number,
  alignmentOrPivot: number | { pivotIndex: number; pivotOffset: number },
  build: (scope: KeylineListScope) => void,
): KeylineList {
  const scope = new KeylineListScope();
  build(scope);
  return typeof alignmentOrPivot === "object"
    ? scope.createWithPivot(size, itemSpacing, alignmentOrPivot.pivotIndex, alignmentOrPivot.pivotOffset)
    : scope.createWithAlignment(size, itemSpacing, alignmentOrPivot);
}

/** Interpolate a single keyline (flags switch at 0.5). */
export function lerpKeyline(start: Keyline, end: Keyline, fraction: number): Keyline {
  return {
    size: lerpValue(start.size, end.size, fraction),
    offset: lerpValue(start.offset, end.offset, fraction),
    unadjustedOffset: lerpValue(start.unadjustedOffset, end.unadjustedOffset, fraction),
    isFocal: fraction < 0.5 ? start.isFocal : end.isFocal,
    isAnchor: fraction < 0.5 ? start.isAnchor : end.isAnchor,
    isPivot: fraction < 0.5 ? start.isPivot : end.isPivot,
    cutoff: lerpValue(start.cutoff, end.cutoff, fraction),
  };
}

/** Interpolate two keyline lists (same length) at `fraction`. */
export function lerpKeylineList(from: KeylineList, to: KeylineList, fraction: number): KeylineList {
  return KeylineList.from(from.map((k, i) => lerpKeyline(k, to[i], fraction)));
}

// ── Strategy keyline builders ───────────────────────────────────────────────────────────────────

export interface MultiBrowseParams {
  carouselMainAxisSize: number;
  preferredItemSize: number;
  itemSpacing: number;
  itemCount: number;
  minSmallItemSize?: number;
  maxSmallItemSize?: number;
}

/** multi-browse: one large + options of medium/small, focused; balances sizes to fit. */
export function multiBrowseKeylineList(p: MultiBrowseParams): KeylineList {
  const [size, preferred, itemSpacing, minSmall, maxSmall] = [
    p.carouselMainAxisSize,
    p.preferredItemSize,
    p.itemSpacing,
    p.minSmallItemSize ?? CarouselDefaults.MinSmallItemSize,
    p.maxSmallItemSize ?? CarouselDefaults.MaxSmallItemSize,
  ].map(f);
  if (size === 0 || preferred === 0) return emptyKeylineList();

  let smallCounts = [1];
  const mediumCounts = [1, 0];
  const targetLargeSize = Math.min(preferred, size);
  const targetSmallSize = coerceIn(f(targetLargeSize / 3), minSmall, maxSmall);
  const targetMediumSize = half(f(targetLargeSize + targetSmallSize));
  if (size < f(minSmall * 2)) smallCounts = [0];

  const minAvailableLargeSpace = f(f(size - f(targetMediumSize * Math.max(...mediumCounts))) - f(maxSmall * Math.max(...smallCounts)));
  const minLargeCount = Math.max(1, toInt(Math.floor(f(minAvailableLargeSpace / targetLargeSize))));
  const maxLargeCount = toInt(Math.ceil(f(size / targetLargeSize)));
  const largeCounts = largeCountRange(minLargeCount, maxLargeCount);
  const anchorSize = CarouselDefaults.AnchorSize;
  const find = (small: number[], medium: number[]): Arrangement | null =>
    Arrangement.findLowestCostArrangement({
      availableSpace: size,
      itemSpacing,
      targetSmallSize,
      minSmallSize: minSmall,
      maxSmallSize: maxSmall,
      smallCounts: small,
      targetMediumSize,
      mediumCounts: medium,
      targetLargeSize,
      largeCounts,
    });
  let arrangement = find(smallCounts, mediumCounts);

  if (arrangement !== null && arrangement.itemCount() > p.itemCount) {
    let surplus = arrangement.itemCount() - p.itemCount;
    let smallCount = arrangement.smallCount;
    let mediumCount = arrangement.mediumCount;
    while (surplus > 0) {
      if (smallCount > 0) smallCount -= 1;
      else if (mediumCount > 1) mediumCount -= 1;
      surplus -= 1;
    }
    arrangement = find([smallCount], [mediumCount]);
  }

  if (arrangement === null) return emptyKeylineList();
  return createLeftAlignedKeylineList(size, itemSpacing, anchorSize, anchorSize, arrangement);
}

export interface UncontainedParams {
  carouselMainAxisSize: number;
  itemSize: number;
  itemSpacing: number;
}

/** uncontained: fixed item size tiled across, with one cut-off item showing at the end. */
export function uncontainedKeylineList(p: UncontainedParams): KeylineList {
  const [size, itemSizeRaw, itemSpacing] = [p.carouselMainAxisSize, p.itemSize, p.itemSpacing].map(f);
  if (size === 0 || itemSizeRaw === 0) return emptyKeylineList();
  const largeItemSize = Math.min(f(itemSizeRaw + itemSpacing), size);
  const largeCount = Math.max(1, toInt(Math.floor(f(size / largeItemSize))));
  const remainingSpace = f(size - f(largeCount * largeItemSize));
  const mediumCount = remainingSpace > 0 ? 1 : 0;
  const defaultAnchorSize = CarouselDefaults.AnchorSize;
  const mediumItemSize = calculateMediumChildSize(defaultAnchorSize, largeItemSize, remainingSpace);
  const arrangement = new Arrangement(0, 0, 0, mediumItemSize, mediumCount, largeItemSize, largeCount);
  const xSmallSize = Math.min(defaultAnchorSize, itemSizeRaw);
  const leftAnchorSize = Math.max(xSmallSize, f(mediumItemSize * 0.5));
  return createLeftAlignedKeylineList(size, itemSpacing, leftAnchorSize, defaultAnchorSize, arrangement);
}

export interface HeroParams {
  carouselMainAxisSize: number;
  preferredItemSize: number | null;
  itemSpacing: number;
  itemCount: number;
  isCentered?: boolean;
  minSmallItemSize?: number;
  maxSmallItemSize?: number;
}

/** centered hero: one large item centred, flanked by small items. */
export function heroKeylineList(p: HeroParams): KeylineList {
  let preferred = p.preferredItemSize;
  const [size, itemSpacing, minSmall, maxSmall] = [
    p.carouselMainAxisSize,
    p.itemSpacing,
    p.minSmallItemSize ?? CarouselDefaults.MinSmallItemSize,
    p.maxSmallItemSize ?? CarouselDefaults.MaxSmallItemSize,
  ].map(f);
  if (preferred !== null) preferred = f(preferred);
  if (size === 0) return emptyKeylineList();
  // A null OR non-positive preference means "use the full container" (matches the reference: a
  // preferredItemSize of 0 yields a large item as big as the carousel).
  if (preferred === null || preferred <= 0) preferred = size;

  const shouldCenter = !!p.isCentered && p.itemCount >= 3;
  let smallCounts = p.itemCount <= 1 ? [0] : shouldCenter ? [2] : [1];
  const targetLargeSize = Math.min(preferred, size);
  const targetSmallSize = coerceIn(f(targetLargeSize / 3), minSmall, maxSmall);

  const fullscreenThreshold = f(f(minSmall * Math.max(...smallCounts)) + f(minSmall * 1.25));
  if (size < fullscreenThreshold) smallCounts = [0];

  const minAvailableLargeSpace = f(size - f(minSmall * Math.max(...smallCounts)));
  const minLargeCount = Math.max(1, toInt(Math.floor(f(minAvailableLargeSpace / targetLargeSize))));
  const maxLargeCount = toInt(Math.ceil(f(size / targetLargeSize)));
  const largeCounts = largeCountRange(minLargeCount, maxLargeCount);
  const anchorSize = CarouselDefaults.AnchorSize;
  const arrangement = Arrangement.findLowestCostArrangement({
    availableSpace: size,
    itemSpacing,
    targetSmallSize,
    minSmallSize: minSmall,
    maxSmallSize: maxSmall,
    smallCounts,
    targetMediumSize: 0,
    mediumCounts: [0],
    targetLargeSize,
    largeCounts,
  });
  if (arrangement === null) return emptyKeylineList();

  return shouldCenter && p.itemCount >= arrangement.itemCount()
    ? createCenterAlignedKeylineList(size, itemSpacing, anchorSize, anchorSize, arrangement)
    : createLeftAlignedKeylineList(size, itemSpacing, anchorSize, anchorSize, arrangement);
}

export function createLeftAlignedKeylineList(
  size: number,
  itemSpacing: number,
  leftAnchorSize: number,
  rightAnchorSize: number,
  arrangement: Arrangement,
): KeylineList {
  return keylineListOf(size, itemSpacing, CarouselAlignment.Start, (scope) => {
    scope.add(leftAnchorSize, true);
    for (let i = 0; i < arrangement.largeCount; i++) scope.add(arrangement.largeSize);
    for (let i = 0; i < arrangement.mediumCount; i++) scope.add(arrangement.mediumSize);
    for (let i = 0; i < arrangement.smallCount; i++) scope.add(arrangement.smallSize);
    scope.add(rightAnchorSize, true);
  });
}

export function createCenterAlignedKeylineList(
  size: number,
  itemSpacing: number,
  leftAnchorSize: number,
  rightAnchorSize: number,
  arrangement: Arrangement,
): KeylineList {
  return keylineListOf(size, itemSpacing, CarouselAlignment.Center, (scope) => {
    scope.add(leftAnchorSize, true);
    for (let i = 0; i < Math.trunc(arrangement.smallCount / 2); i++) scope.add(arrangement.smallSize);
    for (let i = 0; i < Math.trunc(arrangement.mediumCount / 2); i++) scope.add(arrangement.mediumSize);
    for (let i = 0; i < arrangement.largeCount; i++) scope.add(arrangement.largeSize);
    for (let i = 0; i < Math.trunc(arrangement.mediumCount / 2); i++) scope.add(arrangement.mediumSize);
    for (let i = 0; i < Math.trunc(arrangement.smallCount / 2); i++) scope.add(arrangement.smallSize);
    scope.add(rightAnchorSize, true);
  });
}

function calculateMediumChildSize(minimumMediumSize: number, largeItemSize: number, remainingSpace: number): number {
  let mediumItemSize = Math.max(f(remainingSpace * 1.5), minimumMediumSize);
  const largeItemThreshold = f(largeItemSize * f(CarouselDefaults.MediumLargeItemDiffThreshold));
  if (mediumItemSize > largeItemThreshold) {
    const sizeWithFifthCutOff = f(remainingSpace * f(1.2));
    mediumItemSize = Math.min(Math.max(largeItemThreshold, sizeWithFifthCutOff), largeItemSize);
  }
  return mediumItemSize;
}

// ── Strategy: scroll offset → keyline list (moving focus across steps) ───────────────────────────

/** Linear remap with clamping (`Strategy.kt` `lerp`), in Float arithmetic. */
export function lerpRange(outputMin: number, outputMax: number, inputMin: number, inputMax: number, value: number): number {
  if (value <= inputMin) return outputMin;
  if (value >= inputMax) return outputMax;
  return lerpValue(outputMin, outputMax, f(f(value - inputMin) / f(inputMax - inputMin)));
}

const roundToInt = (v: number): number => Math.round(v);

function movedKeylineList(from: KeylineList, srcIndex: number, dstIndex: number, size: number, itemSpacing: number): KeylineList {
  const pivotDir = srcIndex > dstIndex ? 1 : -1;
  const pivotDelta = f(f(f(from[srcIndex].size - from[srcIndex].cutoff) + itemSpacing) * pivotDir);
  const newPivotIndex = from.pivotIndex + pivotDir;
  const newPivotOffset = f(from.pivot.offset + pivotDelta);
  const moved = [...from];
  const [keyline] = moved.splice(srcIndex, 1);
  moved.splice(dstIndex, 0, keyline);
  return keylineListOf(size, itemSpacing, { pivotIndex: newPivotIndex, pivotOffset: newPivotOffset }, (scope) => {
    for (const k of moved) scope.add(k.size, k.isAnchor);
  });
}

function shiftedForContentPadding(from: KeylineList, size: number, itemSpacing: number, contentPadding: number, pivot: Keyline, pivotIndex: number): KeylineList {
  const numberOfNonAnchor = from.filter((k) => !k.isAnchor).length;
  const sizeReduction = f(contentPadding / numberOfNonAnchor);
  const newKeylines = keylineListOf(size, itemSpacing, { pivotIndex, pivotOffset: f(f(pivot.offset - half(sizeReduction)) + contentPadding) }, (scope) => {
    for (const k of from) scope.add(f(k.size - Math.abs(sizeReduction)), k.isAnchor);
  });
  return KeylineList.from(newKeylines.map((k, i) => ({ ...k, unadjustedOffset: from[i].unadjustedOffset })));
}

function startKeylineSteps(defaultKeylines: KeylineList, size: number, itemSpacing: number, beforeContentPadding: number): KeylineList[] {
  if (!defaultKeylines.length) return [];
  const steps: KeylineList[] = [defaultKeylines];
  if (isFirstFocalAtStart(defaultKeylines)) {
    if (beforeContentPadding !== 0) {
      steps.push(shiftedForContentPadding(defaultKeylines, size, itemSpacing, beforeContentPadding, defaultKeylines.firstFocal, defaultKeylines.firstFocalIndex));
    }
    return steps;
  }
  const startIndex = defaultKeylines.firstNonAnchorIndex;
  const endIndex = defaultKeylines.firstFocalIndex;
  const numberOfSteps = endIndex - startIndex;
  if (numberOfSteps <= 0 && defaultKeylines.firstFocal.cutoff > 0) {
    steps.push(movedKeylineList(defaultKeylines, 0, 0, size, itemSpacing));
    return steps;
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prevStep = steps[steps.length - 1];
    const originalItemIndex = startIndex + i;
    let dstIndex = defaultKeylines.length - 1;
    if (originalItemIndex > 0) {
      const originalNeighborBeforeSize = defaultKeylines[originalItemIndex - 1].size;
      dstIndex = prevStep.firstIndexAfterFocalRangeWithSize(originalNeighborBeforeSize) - 1;
    }
    steps.push(movedKeylineList(prevStep, defaultKeylines.firstNonAnchorIndex, dstIndex, size, itemSpacing));
  }
  if (beforeContentPadding !== 0) {
    const last = steps[steps.length - 1];
    steps[steps.length - 1] = shiftedForContentPadding(last, size, itemSpacing, beforeContentPadding, last.firstFocal, last.firstFocalIndex);
  }
  return steps;
}

function endKeylineSteps(defaultKeylines: KeylineList, size: number, itemSpacing: number, afterContentPadding: number): KeylineList[] {
  if (!defaultKeylines.length) return [];
  const steps: KeylineList[] = [defaultKeylines];
  if (isLastFocalAtEnd(defaultKeylines, size)) {
    if (afterContentPadding !== 0) {
      steps.push(shiftedForContentPadding(defaultKeylines, size, itemSpacing, -afterContentPadding, defaultKeylines.lastFocal, defaultKeylines.lastFocalIndex));
    }
    return steps;
  }
  const startIndex = defaultKeylines.lastFocalIndex;
  const endIndex = defaultKeylines.lastNonAnchorIndex;
  const numberOfSteps = endIndex - startIndex;
  if (numberOfSteps <= 0 && defaultKeylines.lastFocal.cutoff > 0) {
    steps.push(movedKeylineList(defaultKeylines, 0, 0, size, itemSpacing));
    return steps;
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prevStep = steps[steps.length - 1];
    const originalItemIndex = endIndex - i;
    let dstIndex = 0;
    if (originalItemIndex < defaultKeylines.length - 1) {
      const originalNeighborAfterSize = defaultKeylines[originalItemIndex + 1].size;
      dstIndex = prevStep.lastIndexBeforeFocalRangeWithSize(originalNeighborAfterSize) + 1;
    }
    steps.push(movedKeylineList(prevStep, defaultKeylines.lastNonAnchorIndex, dstIndex, size, itemSpacing));
  }
  if (afterContentPadding !== 0) {
    const last = steps[steps.length - 1];
    steps[steps.length - 1] = shiftedForContentPadding(last, size, itemSpacing, -afterContentPadding, last.lastFocal, last.lastFocalIndex);
  }
  return steps;
}

function isFirstFocalAtStart(kl: KeylineList): boolean {
  const firstFocalLeft = f(kl.firstFocal.offset - half(kl.firstFocal.size));
  return firstFocalLeft >= 0 && keylineEquals(kl.firstFocal, kl.firstNonAnchor);
}
function isLastFocalAtEnd(kl: KeylineList, size: number): boolean {
  const lastFocalRight = f(kl.lastFocal.offset + half(kl.lastFocal.size));
  return lastFocalRight <= size && keylineEquals(kl.lastFocal, kl.lastNonAnchor);
}

function startShiftDistance(steps: KeylineList[], beforeContentPadding: number): number {
  if (!steps.length) return 0;
  const last = steps[steps.length - 1];
  return Math.max(f(last[0].unadjustedOffset - steps[0][0].unadjustedOffset), beforeContentPadding);
}
function endShiftDistance(steps: KeylineList[], afterContentPadding: number): number {
  if (!steps.length) return 0;
  const last = steps[steps.length - 1];
  return Math.max(f(steps[0][steps[0].length - 1].unadjustedOffset - last[last.length - 1].unadjustedOffset), afterContentPadding);
}
function stepInterpolationPoints(totalShiftDistance: number, steps: KeylineList[], shiftingLeft: boolean): number[] {
  const points = [0];
  if (totalShiftDistance === 0 || !steps.length) return points;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const curr = steps[i];
    const distanceShifted = shiftingLeft
      ? f(curr[0].unadjustedOffset - prev[0].unadjustedOffset)
      : f(prev[prev.length - 1].unadjustedOffset - curr[curr.length - 1].unadjustedOffset);
    const pct = f(distanceShifted / totalShiftDistance);
    points.push(i === steps.length - 1 ? 1 : f(points[i - 1] + pct));
  }
  return points;
}

/** Drives the moving keyline layout as the carousel scrolls (`Strategy.kt`). */
export class Strategy {
  readonly defaultKeylines: KeylineList;
  readonly availableSpace: number;
  readonly itemSpacing: number;
  readonly beforeContentPadding: number;
  readonly afterContentPadding: number;
  readonly startKeylineSteps: KeylineList[];
  readonly endKeylineSteps: KeylineList[];
  readonly minItemSize: number;
  readonly maxItemSize: number;
  readonly startShiftDistance: number;
  readonly endShiftDistance: number;
  readonly startShiftPoints: number[];
  readonly endShiftPoints: number[];
  readonly isValid: boolean;
  #cache: { scrollOffset: number; maxScrollOffset: number; round: boolean; result: KeylineList } | null = null;

  constructor(defaultKeylines: KeylineList, availableSpace: number, itemSpacing: number, beforeContentPadding: number, afterContentPadding: number) {
    [availableSpace, itemSpacing, beforeContentPadding, afterContentPadding] = [availableSpace, itemSpacing, beforeContentPadding, afterContentPadding].map(f);
    this.defaultKeylines = defaultKeylines;
    this.availableSpace = availableSpace;
    this.itemSpacing = itemSpacing;
    this.beforeContentPadding = beforeContentPadding;
    this.afterContentPadding = afterContentPadding;
    this.startKeylineSteps = startKeylineSteps(defaultKeylines, availableSpace, itemSpacing, beforeContentPadding);
    this.endKeylineSteps = endKeylineSteps(defaultKeylines, availableSpace, itemSpacing, afterContentPadding);
    let min = defaultKeylines.minSize;
    let max = defaultKeylines.maxSize;
    for (const step of [...this.startKeylineSteps, ...this.endKeylineSteps]) {
      if (step.minSize < min) min = step.minSize;
      if (step.maxSize > max) max = step.maxSize;
    }
    this.minItemSize = min;
    this.maxItemSize = max;
    this.startShiftDistance = startShiftDistance(this.startKeylineSteps, beforeContentPadding);
    this.endShiftDistance = endShiftDistance(this.endKeylineSteps, afterContentPadding);
    this.startShiftPoints = stepInterpolationPoints(this.startShiftDistance, this.startKeylineSteps, true);
    this.endShiftPoints = stepInterpolationPoints(this.endShiftDistance, this.endKeylineSteps, false);
    this.isValid = defaultKeylines.length > 0 && availableSpace !== 0 && this.itemMainAxisSize !== 0;
  }

  get itemMainAxisSize(): number {
    return this.defaultKeylines.length ? this.defaultKeylines.firstFocal.size : 0;
  }

  getKeylineListForScrollOffset(scrollOffset: number, maxScrollOffset: number, roundToNearestStep = false): KeylineList {
    const c = this.#cache;
    if (c && c.scrollOffset === scrollOffset && c.maxScrollOffset === maxScrollOffset && c.round === roundToNearestStep) return c.result;
    const result = this.#forScrollOffset(scrollOffset, maxScrollOffset, roundToNearestStep);
    this.#cache = { scrollOffset, maxScrollOffset, round: roundToNearestStep, result };
    return result;
  }

  #forScrollOffset(scrollOffset: number, maxScrollOffset: number, roundToNearestStep: boolean): KeylineList {
    const positive = Math.max(0, f(scrollOffset));
    const startShift = this.startShiftDistance;
    maxScrollOffset = f(maxScrollOffset);
    const endShift = Math.max(0, f(maxScrollOffset - this.endShiftDistance));
    if (positive >= startShift && positive <= endShift) return this.defaultKeylines;

    let interpolation = lerpRange(1, 0, 0, startShift, positive);
    let shiftPoints = this.startShiftPoints;
    let steps = this.startKeylineSteps;
    if (positive > endShift) {
      interpolation = lerpRange(0, 1, endShift, maxScrollOffset, positive);
      shiftPoints = this.endShiftPoints;
      steps = this.endKeylineSteps;
    }
    let fromStepIndex = 0;
    let toStepIndex = 0;
    let steppedInterpolation = 0;
    let lower = shiftPoints[0];
    for (let i = 1; i < steps.length; i++) {
      const upper = shiftPoints[i];
      if (interpolation <= upper) {
        fromStepIndex = i - 1;
        toStepIndex = i;
        steppedInterpolation = lerpRange(0, 1, lower, upper, interpolation);
        break;
      }
      lower = upper;
    }
    if (roundToNearestStep) return steps[roundToInt(steppedInterpolation) === 0 ? fromStepIndex : toStepIndex];
    return lerpKeylineList(steps[fromStepIndex], steps[toStepIndex], steppedInterpolation);
  }
}

/** Where item `itemIndex` rests, from the carousel start (`KeylineSnapPosition`). */
export function getSnapPositionOffset(strategy: Strategy, itemIndex: number, itemCount: number): number {
  if (!strategy.isValid) return 0;
  let offset = roundToInt(f(strategy.defaultKeylines.firstFocal.unadjustedOffset - half(strategy.itemMainAxisSize)));
  const startLast = strategy.startKeylineSteps.length - 1;
  if (startLast >= 0 && itemIndex <= startLast) {
    const stepIndex = coerceIn(startLast - itemIndex, 0, startLast);
    const startKeylines = strategy.startKeylineSteps[stepIndex];
    if (startKeylines) offset = roundToInt(f(startKeylines.firstFocal.unadjustedOffset - half(strategy.itemMainAxisSize)));
  }
  const lastItemIndex = itemCount - 1;
  const endLast = strategy.endKeylineSteps.length - 1;
  if (endLast >= 0 && itemIndex >= lastItemIndex - endLast && itemCount > strategy.defaultKeylines.focalCount) {
    const stepIndex = coerceIn(endLast - (lastItemIndex - itemIndex), 0, endLast);
    const endKeylines = strategy.endKeylineSteps[stepIndex];
    if (endKeylines) offset = roundToInt(f(endKeylines.lastFocal.unadjustedOffset - half(strategy.itemMainAxisSize)));
  }
  return offset;
}

/** Scroll offset from the pager's current page + offset fraction. */
export function calculateCurrentScrollOffset(strategy: Strategy, currentPage: number, currentPageOffsetFraction: number, pageCount: number): number {
  const itemSizeWithSpacing = f(strategy.itemMainAxisSize + strategy.itemSpacing);
  const currentItemScrollOffset = f(f(currentPage * itemSizeWithSpacing) + f(f(currentPageOffsetFraction) * itemSizeWithSpacing));
  return f(currentItemScrollOffset - getSnapPositionOffset(strategy, currentPage, pageCount));
}

/** The pager's scroll range. */
export function calculateMaxScrollOffset(strategy: Strategy, itemCount: number): number {
  const maxScrollPossible = f(f(strategy.itemMainAxisSize * itemCount) + f(strategy.itemSpacing * f(itemCount - 1)));
  return Math.max(0, f(maxScrollPossible - strategy.availableSpace));
}

/** An item's mask extent and translation for a scroll offset (`Modifier.carouselItem`). */
export function carouselItemPlacement(
  strategy: Strategy,
  index: number,
  scrollOffset: number,
  maxScrollOffset: number,
): { size: number; maskStart: number; maskEnd: number; translation: number; keyline: Keyline } {
  scrollOffset = f(scrollOffset);
  const keylines = strategy.getKeylineListForScrollOffset(scrollOffset, maxScrollOffset);
  const itemSizeWithSpacing = f(strategy.itemMainAxisSize + strategy.itemSpacing);
  const unadjustedCenter = f(f(f(index * itemSizeWithSpacing) + half(strategy.itemMainAxisSize)) - scrollOffset);
  const before = keylines.getKeylineBefore(unadjustedCenter);
  const after = keylines.getKeylineAfter(unadjustedCenter);
  const outOfBounds = keylineEquals(before, after);
  const progress = outOfBounds ? 1 : f(f(unadjustedCenter - before.unadjustedOffset) / f(after.unadjustedOffset - before.unadjustedOffset));
  const interpolated = lerpKeyline(before, after, progress);
  const center = half(strategy.itemMainAxisSize);
  const halfMask = half(interpolated.size);
  let translation = f(interpolated.offset - unadjustedCenter);
  if (outOfBounds) translation = f(translation + f(f(unadjustedCenter - interpolated.unadjustedOffset) / interpolated.size));
  return { size: interpolated.size, maskStart: f(center - halfMask), maskEnd: f(center + halfMask), translation, keyline: interpolated };
}
