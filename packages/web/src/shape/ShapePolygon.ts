import { CSSResult, unsafeCSS } from "lit";

import { MaterialShapeData, type MaterialShapeName } from "./MaterialShapeData";
import { shapeToClipPath } from "./shapeClipPath";

/**
 * The `clip-path: polygon(...)` value for each of the 35 Material 3 Expressive shapes,
 * generated from the shared, Apache-2.0 attributed `MaterialShapeData` source.
 *
 * @internal
 */
const _ShapePolygon: Partial<Record<MaterialShapeName, CSSResult>> = {};
for (const name in MaterialShapeData) {
  _ShapePolygon[name as MaterialShapeName] = unsafeCSS(shapeToClipPath(name as MaterialShapeName));
}

/**
 * Normalized polygons for each shape.
 * @internal
 */
export const ShapePolygon = _ShapePolygon as Record<MaterialShapeName, CSSResult>;
