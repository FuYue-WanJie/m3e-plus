/**
 * Edge button shape geometry — a faithful port of AndroidX Wear Material3 `EdgeButtonShape`
 * (`androidx/wear/compose/material3/EdgeButton.kt`).
 *
 * The edge button is a bottom-of-screen action: its top half is a rounded (circular) arc and its
 * bottom half is an ellipse (ellipsis) that meets the screen edge. As the button shrinks its lower
 * half morphs from the ellipse toward a rounded rectangle (two quarter circles joined by a growing
 * flat line), matching the source's `finalFadeProgress`.
 *
 * All dimensions are in dp (callers pass the button's dp width/height); we emit an SVG path string
 * in the same coordinate space (viewBox = width x height dp), so it scales 1:1.
 */

/** Tunables from `EdgeButton.kt`. */
export const EdgeButtonDefaults = Object.freeze({
  /** `EdgeButtonVerticalPadding` — gap reserved under the shape at the screen edge (dp). */
  verticalPadding: 3,
  /** `EXTRA_SMALL_ELLIPSIS_HEIGHT` (dp) — ellipsis height at/above the extra-small height. */
  extraSmallEllipsisHeight: 58,
  /** `BUTTON_TO_ELLIPSIS_RATIO` — ellipsis height growth per dp of button height. */
  buttonToEllipsisRatio: 1.42,
  /** `TARGET_SIDE_PADDING` (dp) — extra side inset beyond the geometric fit. */
  targetSidePadding: 20,
  /** `EdgeButtonSize.ExtraSmall.maximumHeight` (dp) — below this the shape fades to a rounded rect. */
  extraSmallHeight: 46,
});

/** The geometry computed for one size (all dp). Mirrors `ShapeHelper`. */
export interface EdgeButtonGeometry {
  /** Horizontal inset of the shape from the button's left/right edges. */
  sidePadding: number;
  /** 0 at >= extra-small height, 1 when height=0 (drives the morph to a rounded rectangle). */
  finalFadeProgress: number;
  /** Height of the bottom ellipsis. */
  ellipsisHeight: number;
  /** Radius of the top rounded corners. */
  radius: number;
  /** Usable content rect (for laying out the slotted content). */
  contentLeft: number;
  contentTop: number;
  contentRight: number;
  contentBottom: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Compute the ShapeHelper values for a given size. */
export function edgeButtonGeometry(width: number, height: number): EdgeButtonGeometry {
  const {
    extraSmallHeight,
    extraSmallEllipsisHeight,
    buttonToEllipsisRatio,
    targetSidePadding,
    verticalPadding,
  } = EdgeButtonDefaults;

  if (height <= 0) {
    return { sidePadding: 0, finalFadeProgress: 1, ellipsisHeight: 0, radius: 0, contentLeft: 0, contentTop: 0, contentRight: width, contentBottom: 0 };
  }

  const finalFadeProgress = Math.max(0, 1 - height / extraSmallHeight);
  const ellipsisHeight = lerp(
    extraSmallEllipsisHeight + (height - extraSmallHeight) * buttonToEllipsisRatio,
    height,
    finalFadeProgress,
  );

  const halfW = width / 2;
  const localHalfWidth = Math.sqrt(Math.max(0, halfW * halfW - (halfW - verticalPadding - ellipsisHeight / 2) ** 2));
  const sidePadding = halfW - localHalfWidth + targetSidePadding;

  const radius = height - ellipsisHeight / 2;

  // `Rect.inset` in the source coerces negative sizes to zero: the content window never inverts.
  const contentInsetLeft = sidePadding + radius;
  const contentInsetRight = width - sidePadding - radius;
  const contentLeft = Math.min(contentInsetLeft, width / 2);
  const contentRight = Math.max(contentInsetRight, width / 2);

  return {
    sidePadding,
    finalFadeProgress,
    ellipsisHeight,
    radius,
    contentLeft,
    contentTop: 0,
    contentRight,
    contentBottom: height,
  };
}

/**
 * Build the SVG path `d` for the edge button shape at the given size. Mirrors the `Path` built in
 * `EdgeButtonShape.createOutline`. The path is in a `0 0 width height` space.
 */
export function edgeButtonPathData(width: number, height: number): string {
  const g = edgeButtonGeometry(width, height);
  const { ellipsisHeight, finalFadeProgress } = g;
  const screenRadius = width / 2 - EdgeButtonDefaults.verticalPadding;

  const ellipsisCenterX = width / 2;
  const ellipsisCenterY = height - ellipsisHeight / 2;
  const ellipsisRadiusY = ellipsisHeight / 2;
  const ellipsisRadiusX = Math.min(Math.sqrt(ellipsisRadiusY * screenRadius), screenRadius);

  // Angle at which the ellipsis transitions to the (circular) top arc. At finalFadeProgress=1 the
  // whole lower half becomes right angles (ellipsis -> rounded rectangle).
  const ellipsisCutAngle = (finalFadeProgress * Math.PI) / 2;

  const epX = ellipsisRadiusX * Math.cos(ellipsisCutAngle);
  const epY = ellipsisRadiusY * Math.sin(ellipsisCutAngle);
  const transitionX = ellipsisCenterX + epX;
  const transitionY = ellipsisCenterY + epY;

  // Normalized tangent at the transition point.
  let tanX = ellipsisRadiusX * Math.sin(ellipsisCutAngle);
  let tanY = -ellipsisRadiusY * Math.cos(ellipsisCutAngle);
  const tanLen = Math.hypot(tanX, tanY) || 1;
  tanX /= tanLen;
  tanY /= tanLen;

  const circleRadius = transitionY / (1 + tanX);
  // circleCenter = transitionPoint + rotate90ccw(tangent) * circleRadius ; rotate90ccw((x,y))=(y,-x)
  const circleCenterX = transitionX + tanY * circleRadius;
  const circleCenterY = transitionY + -tanX * circleRadius;

  const ctX = transitionX - circleCenterX;
  const ctY = transitionY - circleCenterY;
  const sweep = (Math.atan2(ctY, ctX) * 180) / Math.PI + 90;
  const epAngle = (ellipsisCutAngle * 180) / Math.PI;

  const deg = (d: number) => (d * Math.PI) / 180;
  const parts: string[] = [];

  // Right arc: start at top of the circle (circleCenter + (0,-r)), sweep.
  const rightStartX = circleCenterX;
  const rightStartY = circleCenterY - circleRadius;
  parts.push(`M ${fr(rightStartX)} ${fr(rightStartY)}`);
  parts.push(arc(circleCenterX, circleCenterY, circleRadius, circleRadius, 270, sweep, false));

  // Bottom side — ellipsis. Its rect: center on x, bottom at height.
  const epRectCx = width / 2;
  const epRectCy = height - ellipsisHeight / 2;
  parts.push(arc(epRectCx, epRectCy, ellipsisRadiusX, ellipsisRadiusY, epAngle, 180 - 2 * epAngle, false));

  // Left arc (mirror of the right): center mirrored across width.
  const leftCx = width - circleCenterX;
  const leftCy = circleCenterY;
  parts.push(arc(leftCx, leftCy, circleRadius, circleRadius, 270 - sweep, sweep, false));

  parts.push("Z");
  return parts.join(" ");

  function fr(n: number): string {
    return `${Math.round(n * 100) / 100}`;
  }
  /** SVG elliptical arc; emit an explicit `L` to the start first so chaining is exact. */
  function arc(cx: number, cy: number, rx: number, ry: number, startDeg: number, sweepDeg: number, _ccw: boolean): string {
    const a0 = deg(startDeg);
    const a1 = deg(startDeg + sweepDeg);
    const x0 = cx + rx * Math.cos(a0);
    const y0 = cy + ry * Math.sin(a0);
    const x1 = cx + rx * Math.cos(a1);
    const y1 = cy + ry * Math.sin(a1);
    const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
    const sweepFlag = sweepDeg >= 0 ? 1 : 0;
    return `L ${fr(x0)} ${fr(y0)} A ${fr(rx)} ${fr(ry)} 0 ${large} ${sweepFlag} ${fr(x1)} ${fr(y1)}`;
  }
}
