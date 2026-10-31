# @wanjie/m3e-web/wear

Wear OS Material 3 components, ported from AndroidX **`androidx.wear.compose.material3`**
(`androidx/androidx/wear/compose/compose-material3`). Kept in a separate `wear/` area so they stay
visually and structurally distinct from the handheld `material3` components.

## Components

| Element | Source | Notes |
| --- | --- | --- |
| `m3e-edge-button` | `EdgeButton.kt` (`EdgeButtonShape`) | Bottom-of-screen action with a custom arc-top / ellipse-bottom container that morphs to a rounded rectangle when small. |

## Conventions

- One folder per component: `wear/<name>/` with `<Name>Element.ts` (+ `index.ts` barrel). Pure geometry
  / math helpers live beside the element (e.g. `edgeButtonPath.ts`).
- Register the module: add `wear/<name>` to `packages/web/rollup.config.js` `inputs`,
  `packages/web/package.json` `files` + `exports["./wear/<name>"]`, and barrel it via `src/wear/index.ts`
  (already re-exported from `src/all.ts`).
- Custom properties use the `--m3e-edge-button-*` / component-scoped naming (do not reuse handheld
  component variables unless intentional).
- Colour/tokens: fall back to the shared `--m3e-color-*` / DesignToken roles so the Wear pieces theme
  consistently with the rest of the library.

## Adding a Wear component

1. Read the AndroidX Wear source (`/workspace/androidx/wear/compose/compose-material3/src/main/java/androidx/wear/compose/material3/`).
2. Port any pure geometry/shape math to a standalone, testable `.ts` module first.
3. Build the element, keeping it self-contained (its own tiny lifecycle) unless it genuinely needs the
   handheld `Button` base.
4. Add a `test-<name>.html` at the repo root and verify in Chromium.
