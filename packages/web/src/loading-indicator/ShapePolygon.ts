import { CSSResult, unsafeCSS } from "lit";

import { generateClipPaths } from "@wanjie/m3e-web/core";
import { materialShapePath, type MaterialShapeName } from "../shape/MaterialShapeData";

/**
 * The seven shapes the indeterminate loading indicator morphs through, keyed by the
 * shortened names used internally. Each maps to a named `MaterialShapes` entry so the
 * geometry comes from the shared, Apache-2.0 attributed `MaterialShapeData` source rather
 * than hand-transcribed SVG paths.
 *
 * Order matches AndroidX `LoadingIndicatorDefaults.IndeterminateIndicatorPolygons`:
 * SoftBurst, Cookie9Sided, Pentagon, Pill, Sunny, Cookie4Sided, Oval.
 */
const SHAPE_NAMES: Record<string, MaterialShapeName> = {
  "soft-burst": "soft-burst",
  "9-sided-cookie": "9-sided-cookie",
  pentagon: "pentagon",
  pill: "pill",
  sunny: "sunny",
  "4-sided-cookie": "4-sided-cookie",
  oval: "oval",
};

/** Unit-square SVG path for each shape, sourced from `MaterialShapeData`. */
const SHAPE_PATHS: Record<string, string> = {};
for (const key in SHAPE_NAMES) {
  SHAPE_PATHS[key] = materialShapePath(SHAPE_NAMES[key]);
}

let shapes = new Array<string>();
const indexMap = new Map<string, number>();
for (const key in SHAPE_PATHS) {
  shapes.push(SHAPE_PATHS[key]);
  indexMap.set(key, shapes.length - 1);
}

const _ShapePolygon: Record<string, CSSResult> = {};

shapes = generateClipPaths(shapes, 300);
for (const item of indexMap) {
  _ShapePolygon[item[0]] = unsafeCSS(shapes[item[1]]);
}

/**
 * Normalized polygons for each shape.
 * @internal
 */
export const ShapePolygon: Record<string, CSSResult> = _ShapePolygon;

/**
 * The raw SVG path data for each shape, for the shape-morphing geometry engine.
 * @internal
 */
export const ShapePathData: Readonly<Record<string, string>> = SHAPE_PATHS;
