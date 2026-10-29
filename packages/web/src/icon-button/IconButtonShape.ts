import { isMaterialShapeName, type MaterialShapeName } from "@wanjie/m3e-web/shape";

/**
 * Specifies the possible shape variants of an icon button.
 *
 * Besides the two corner variants (`rounded` = pill, `square` = rounded-square), any of the 35
 * Material 3 Expressive named shapes (`pill`, `4-leaf-clover`, `4-sided-cookie`, `burst`, …) may be
 * used. A named shape is a plain `Shape` (rendered via `clip-path`), not a corner morph — matching
 * AndroidX, where a non-`CornerBasedShape` is used as-is (no pressed/checked morph).
 */
export type IconButtonShape = "rounded" | "square" | MaterialShapeName;

/**
 * Determines whether a value is an `IconButtonShape`.
 * @param {unknown} value The value to test.
 * @returns Whether `value` is an `IconButtonShape`.
 */
export function isIconButtonShape(value: unknown): value is IconButtonShape {
  return value === "rounded" || value === "square" || isMaterialShapeName(value);
}

/** Whether the shape is a corner-based variant (rounded/square), i.e. NOT a named Material shape. */
export function isCornerVariantShape(value: IconButtonShape): value is "rounded" | "square" {
  return value === "rounded" || value === "square";
}
