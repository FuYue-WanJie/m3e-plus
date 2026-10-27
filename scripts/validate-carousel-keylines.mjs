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

function build(c) {
  const sp = c.spacing;
  const av = c.available;
  if (c.layout === "multi-browse")
    return k.multiBrowseKeylineList({ carouselMainAxisSize: av, preferredItemSize: c.preferred, itemSpacing: sp, itemCount: c.count });
  if (c.layout === "uncontained")
    return k.uncontainedKeylineList({ carouselMainAxisSize: av, itemSize: c.preferred, itemSpacing: sp });
  if (c.layout === "hero")
    return k.heroKeylineList({ carouselMainAxisSize: av, preferredItemSize: c.preferred === 0 ? null : c.preferred, itemSpacing: sp, itemCount: c.count, isCentered: true });
  return null;
}

let pass = 0;
let fail = 0;
let maxErr = 0;
for (const c of oracle.cases) {
  let mine;
  try {
    mine = build(c);
  } catch {
    fail++;
    continue;
  }
  const ref = c.keylines;
  let ok = mine.length === ref.length;
  if (ok) {
    for (let i = 0; i < ref.length; i++) {
      const r = ref[i];
      const m = mine[i];
      const errs = [Math.abs(m.size - r[0]), Math.abs(m.offset - r[1]), Math.abs(m.unadjustedOffset - r[2]), Math.abs(m.cutoff - r[6])];
      maxErr = Math.max(maxErr, ...errs);
      if (Math.max(...errs) > 0.02 || m.isFocal !== r[3] || m.isAnchor !== r[4] || m.isPivot !== r[5]) ok = false;
    }
  }
  if (ok) pass++;
  else fail++;
}

console.log(`carousel keylines: PASS ${pass}/${oracle.cases.length}  fail=${fail}  maxNumericErr=${maxErr.toExponential(2)}`);
process.exit(fail === 0 ? 0 : 1);
