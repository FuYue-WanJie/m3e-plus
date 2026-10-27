# Third-party notices

m3e-plus is licensed under the MIT License (see `LICENSE`). Some files contain code or data
ported or adapted from the third-party works below, which are licensed under the Apache License,
Version 2.0. Those portions remain under Apache-2.0; the full license text is in
`LICENSES/Apache-2.0.txt` (also at https://www.apache.org/licenses/LICENSE-2.0).
Files listed here have been modified from the originals (translated to TypeScript/JavaScript and
adapted for the web).

## Android Open Source Project — AndroidX Jetpack Compose

Copyright The Android Open Source Project.
Licensed under the Apache License, Version 2.0.
https://android.googlesource.com/platform/frameworks/support/ (mirror: https://github.com/androidx/androidx)

Ported or adapted in:

| File | Source |
| --- | --- |
| `packages/web/src/carousel/carousel-keylines.ts` | material3 carousel `Keylines.kt`, `KeylineList.kt`, `Arrangement.kt`, `Strategy.kt` |
| `packages/web/src/shape/MaterialShapeData.ts` | graphics-shapes / material3 `MaterialShapes.kt` shape data (via material-shapes-ts) |
| `packages/web/src/geometry/shape-morph.ts` | graphics-shapes `Morph` / `MaterialShapes` concepts |
| `packages/web/src/physics/SpringSimulation.ts` | animation-core `SpringSimulation.kt` |
| `packages/web/src/progress-indicator/wavy.ts` | material3 `WavyProgressIndicator.kt` |
| `packages/web/src/progress-indicator/classic-progress.ts` | material3 `ProgressIndicator.kt` |
| `packages/web/src/geometry/circular-wavy.ts` | material3 `CircularWavyProgressIndicator` |
| `packages/web/src/slider/slider-track.ts` | material3 `Slider.kt` track drawing |
| `packages/web/src/button-group/squeeze.ts` | material3 `ButtonGroup` enlarge-on-press behaviour |
| `test-carousel.html` (motion section) | ui `VelocityTracker.kt` (Lsq2), foundation `SplineBasedDecay.kt` / `FlingCalculator.kt`, `PagerSnapLayoutInfoProvider`, animation-core spring |

## material-shapes-ts

Licensed under the Apache License, Version 2.0. https://www.npmjs.com/package/material-shapes-ts
Source of the shape data in `packages/web/src/shape/MaterialShapeData.ts` (itself derived from
AndroidX graphics-shapes).

## MD3 Expressive for Web (md3e-web-unofficial)

Copyright 2025-2026 Material Web Unofficial Contributors.
Licensed under the Apache License, Version 2.0.
https://github.com/materialwebunofficial/materialwebunofficial.github.io

Adapted in:

| File | Source |
| --- | --- |
| `packages/web/src/slider/slider-track.ts` | `src/components/slider-layout.js` |
| `test-carousel.html` (motion section) | `src/motion/velocity-tracker.js`, `android-fling.js`, `spring-physics.js`, `touch-slop.js`; snap and fling logic from `src/components/md-carousel.js` |

Upstream NOTICE (relevant excerpt):

> MD3 Expressive for Web (md3e-web-unofficial) [Unofficial Web Adaptation]
> Copyright 2025-2026 Material Web Unofficial Contributors
>
> This product is an independent, unofficial community web adaptation and includes software and
> design specifications developed by or derived from third-party works, including the Material
> Design 3 & Material 3 Expressive Design System (Copyright Google LLC) and the Android Open Source
> Project — AndroidX Jetpack Compose Material 3 (Copyright The Android Open Source Project), both
> licensed under the Apache License, Version 2.0.

## Material Design 3

Design tokens, shapes and motion specifications follow Material Design 3 / Material 3 Expressive
(Copyright Google LLC, https://m3.material.io/).
