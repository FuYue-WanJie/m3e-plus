// Validates the carousel keyline engine (src/carousel/carousel-keylines.ts) against the reference
// oracle (scripts/carousel-oracle.json, generated from AndroidX carousel sources). Run:
//   npm run build   (to produce dist/carousel.js) then
//   node scripts/validate-carousel-keylines.mjs
import * as k from "../packages/web/dist/carousel.js";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const oracle = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, "carousel-oracle.json.gz"))).toString("utf8"));

function buildDefault(c) {
  const sp = c.spacing;
  const av = c.available;
  if (c.layout === "multi-browse")
    return k.multiBrowseKeylineList({ carouselMainAxisSize: av, preferredItemSize: c.preferred, itemSpacing: sp, itemCount: c.count });
  if (c.layout === "uncontained")
    return k.uncontainedKeylineList({ carouselMainAxisSize: av, itemSize: c.preferred, itemSpacing: sp });
  return k.heroKeylineList({ carouselMainAxisSize: av, preferredItemSize: c.preferred === 0 ? null : c.preferred, itemSpacing: sp, itemCount: c.count, isCentered: true });
}

const toArr = (kl) => kl.map((x) => [x.size, x.offset, x.unadjustedOffset, x.isFocal, x.isAnchor, x.isPivot, x.cutoff]);
const klEq = (mine, ref, tol) => {
  if (mine.length !== ref.length) return false;
  for (let i = 0; i < ref.length; i++) {
    const m = mine[i];
    const r = ref[i];
    if (Math.max(Math.abs(m[0] - r[0]), Math.abs(m[1] - r[1]), Math.abs(m[2] - r[2]), Math.abs(m[6] - r[6])) > tol) return false;
    if (m[3] !== r[3] || m[4] !== r[4] || m[5] !== r[5]) return false;
  }
  return true;
};

let keylinePass = 0, stepPass = 0, stepTotal = 0, snapPass = 0, snapTotal = 0, plPass = 0, plTotal = 0, scrollPass = 0;
let maxErr = 0;
for (const c of oracle.cases) {
  let def;
  try {
    def = buildDefault(c);
  } catch {
    continue;
  }
  // keylines
  if (klEq(toArr(def), c.keylines, 0.02)) keylinePass++;
  // strategy steps
  const strat = new k.Strategy(def, c.available, c.spacing, c.padding || 0, c.padding || 0);
  if (c.start) {
    stepTotal++;
    if (strat.startKeylineSteps.length === c.start.length && strat.startKeylineSteps.every((s, i) => klEq(toArr(s), c.start[i], 0.02))) stepPass++;
  }
  if (c.end) {
    stepTotal++;
    if (strat.endKeylineSteps.length === c.end.length && strat.endKeylineSteps.every((s, i) => klEq(toArr(s), c.end[i], 0.02))) stepPass++;
  }
  // snap
  if (c.snap) {
    snapTotal++;
    if (c.snap.every((ref, idx) => Math.abs(k.getSnapPositionOffset(strat, idx, c.count) - ref) <= 1)) snapPass++;
  }
  // placements: [page, fraction, index, [ratio, scroll, maxScroll, size, maskLeft, maskRight, translation, bool]]
  if (c.placements && c.placements.length) {
    for (const [page, fraction, index, inner] of c.placements) {
      const [, refScroll, refMax, size, maskLeft, maskRight, translation] = inner;
      const scroll = k.calculateCurrentScrollOffset(strat, page, fraction, c.count);
      const max = k.calculateMaxScrollOffset(strat, c.count);
      if (Math.abs(scroll - refScroll) <= 1 && Math.abs(max - refMax) <= 1) scrollPass++;
      const pl = k.carouselItemPlacement(strat, index, scroll, max);
      plTotal++;
      const err = Math.max(Math.abs(pl.size - size), Math.abs(pl.maskStart - maskLeft), Math.abs(pl.maskEnd - maskRight), Math.abs(pl.translation - translation));
      maxErr = Math.max(maxErr, err);
      if (err <= 0.06) plPass++;
    }
  }
}

const total = oracle.cases.length;
const ok = keylinePass === total && stepPass === stepTotal && snapPass === snapTotal && plPass === plTotal;
console.log(`carousel keylines: ${keylinePass}/${total}`);
console.log(`start/end steps:   ${stepPass}/${stepTotal}`);
console.log(`snap:              ${snapPass}/${snapTotal}`);
console.log(`scroll offsets:    ${scrollPass}/${plTotal}`);
console.log(`placements:        ${plPass}/${plTotal}  (maxErr=${maxErr.toExponential(2)})`);
console.log(ok ? "ALL PASS" : "HAS FAIL");
process.exit(ok ? 0 : 1);
