/**
 * Level indicator geometry — a port of AndroidX Wear Material3 `LevelIndicator` /
 * `ScrollIndicator.IndicatorImpl` arc math.
 *
 * The indicator is a curved stroke on one side of a circular screen. The arc geometry derives
 * everything from the screen diameter, the edge padding and the stroke width:
 * - usable radius = diameter/2 - edgePadding
 * - arc radius    = usable radius - strokeWidth/2 (the stroke is centered on this radius)
 * - the indicator's visible height maps to a sweep angle via 2·asin(h/2/r)
 * - a gap (strokeWidth + gapHeight) is added after the indicator's sweep, in degrees
 */

/** Tunables from `LevelIndicatorDefaults` / `ScrollIndicatorDefaults` / `PaddingDefaults`. */
export const LevelIndicatorDefaults = Object.freeze({
  /**
   * The sweep angle for the curved level indicator, measured up to the centers of the stroke
   * caps. 72° equates to 20% of the circumference (360/5).
   */
  sweepAngle: 72,
  /** The default stroke width for the indicator and track strokes (dp). */
  strokeWidth: 6,
  /** `PaddingDefaults.edgePadding` — distance between the arc and the screen edge (dp). */
  edgePadding: 2,
  /** `ScrollIndicatorDefaults.gapHeight` — visual gap between segments, in dp of arc height. */
  gapHeight: 3,
  /** `ScrollIndicatorDefaults.indicatorHeight` (dp). */
  scrollIndicatorHeight: 50,
  /** `ScrollIndicatorDefaults.indicatorWidth` (dp; 6 on large screens). */
  scrollIndicatorWidth: 5,
  /** `ScrollIndicatorDefaults.min/maxSizeFraction`. */
  minSizeFraction: 0.3,
  maxSizeFraction: 0.7,
});

export interface LevelIndicatorArcGeometry {
  /** Radius at the stroke center. */
  arcRadius: number;
  /** Screen diameter minus paddings; the arc's bounding box is (2*usableRadius - strokeWidth). */
  usableRadius: number;
  /** The indicator's sweep in degrees, including the gap padding (matches `sweepDegrees`). */
  sweepDegrees: number;
  /** The gap-only sweep in degrees (subtracted from each segment's sweep when drawing). */
  gapPaddingDegrees: number;
}

/**
 * Compute the arc geometry for one indicator layout (`IndicatorImpl`). All units in px (dp at 1x).
 *
 * `indicatorHeight` is the straight-line height of the indicator (ScrollIndicator: 50dp). Heights
 * are converted to degrees against the usable radius, as `pixelsHeightToDegrees(h, usableRadius)`.
 */
export function levelIndicatorArcGeometry(
  diameter: number,
  strokeWidth: number,
  indicatorHeight: number,
  gapHeight: number = LevelIndicatorDefaults.gapHeight,
  edgePadding: number = LevelIndicatorDefaults.edgePadding,
): LevelIndicatorArcGeometry {
  const usableRadius = Math.max(0, diameter / 2 - edgePadding);
  const arcRadius = Math.max(0, usableRadius - strokeWidth / 2);
  const heightToDegrees = (height: number): number =>
    usableRadius > 0 ? 2 * Math.asin(Math.min(1, Math.max(-1, height / 2 / usableRadius))) * (180 / Math.PI) : 0;
  const gapPaddingDegrees = heightToDegrees(strokeWidth + gapHeight);
  const sweepDegrees = heightToDegrees(indicatorHeight) + gapPaddingDegrees;
  return { usableRadius, arcRadius, sweepDegrees, gapPaddingDegrees };
}

/**
 * `LevelIndicator` converts its sweep angle into an indicator height:
 * `2 * sin(sweep / 2) * (diameter / 2 - edgePadding - strokeWidth / 2)`.
 */
export function levelIndicatorHeight(
  diameter: number,
  strokeWidth: number,
  sweepAngle: number,
  edgePadding: number = LevelIndicatorDefaults.edgePadding,
): number {
  const radius = Math.max(0, diameter / 2 - edgePadding - strokeWidth / 2);
  return 2 * Math.sin(((0.5 * sweepAngle) * Math.PI) / 180) * radius;
}

export interface IndicatorSegments {
  /** Background sweep before the thumb (degrees, gap-aware; may be ≤ gapPadding = dot). */
  top: { start: number; sweep: number };
  /** The active/thumb segment. */
  mid: { start: number; sweep: number };
  /** Background sweep after the thumb. */
  bottom: { start: number; sweep: number };
}

/**
 * Split the full sweep into top/mid/bottom segments given the thumb's start and size fractions
 * (`indicatorStart = position * (1 - size)`, per `drawCurvedIndicator`).
 */
export function indicatorSegments(
  sweepDegrees: number,
  indicatorStart: number,
  indicatorSize: number,
): IndicatorSegments {
  const startTop = -sweepDegrees / 2;
  const sweepTop = sweepDegrees * indicatorStart;
  const startMid = startTop + sweepTop;
  const sweepMid = sweepDegrees * indicatorSize;
  const startBottom = startMid + sweepMid;
  const sweepBottom = sweepDegrees * (1 - indicatorSize - indicatorStart);
  return {
    top: { start: startTop, sweep: Math.max(sweepTop, 0) },
    mid: { start: startMid, sweep: Math.max(sweepMid, 0) },
    bottom: { start: startBottom, sweep: Math.max(sweepBottom, 0) },
  };
}
