import { normalizePolygon, polygonToClipPath, sampleSvgPath } from "@wanjie/m3e-web/geometry";

import { MaterialShapeData, materialShapePath, type MaterialShapeName } from "./MaterialShapeData";

/**
 * Convert a named Material 3 Expressive shape into a CSS `clip-path: polygon(...)` value.
 *
 * The shape is a `RoundedPolygon` (unit square); we sample its outline into points and emit a
 * percentage `polygon()`, so the result scales to any element size. Used to render icon buttons (and
 * other containers) with named shapes — a plain `Shape` on Surface, not a corner morph.
 *
 * Results are cached per (name, samples) because the same shape is reused across many elements.
 */
const cache = new Map<string, string>();
const DEFAULT_SAMPLES = 96;

/** Returns a CSS `clip-path` value (`polygon(...)`) for the named shape. */
export function shapeToClipPath(name: MaterialShapeName, samples = DEFAULT_SAMPLES): string {
  const key = `${name}|${samples}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // materialShapePath gives a unit-square SVG path; sample it and emit a percentage polygon.
  const points = normalizePolygon(sampleSvgPath(materialShapePath(name), samples));
  const value = polygonToClipPath(points);
  cache.set(key, value);
  return value;
}

/** Whether a string is a known Material shape name (has data). */
export function isMaterialShapeName(value: unknown): value is MaterialShapeName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MaterialShapeData, value);
}
