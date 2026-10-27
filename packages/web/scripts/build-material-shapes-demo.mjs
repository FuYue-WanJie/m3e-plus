/**
 * Builds test-material-shapes.html (repo root): a self-contained demo of the 35 Material shapes
 * rendered from src/shape/MaterialShapeData.ts and morphed with AndroidX's Morph (via material-shapes-ts).
 *
 * Run from the repo root: node packages/web/scripts/build-material-shapes-demo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { rollup } from "rollup";

const here = (p) => new URL(p, import.meta.url);
const bundle = await rollup({ input: "virtual-entry", plugins: [{
  name: "entry",
  resolveId: (id) => (id === "virtual-entry" ? id : null),
  load: (id) => id === "virtual-entry"
    ? `export { RoundedPolygon, Corner, Edge, Cubic, Morph } from ${JSON.stringify(new URL("../../../node_modules/material-shapes-ts/dist/index.js", import.meta.url).pathname)};`
    : null,
}] });
const { output } = await bundle.generate({ format: "iife", name: "MS" });
const lib = output[0].code;

const block = (src, marker) => {
  const a = src.indexOf(marker);
  return src.slice(src.indexOf("{", src.indexOf("= ", a)), src.indexOf("\n};", a) + 2);
};
const data = block(readFileSync(here("../src/shape/MaterialShapeData.ts"), "utf8"), "export const MaterialShapeData");
const old = block(readFileSync(here("../src/shape/ShapePolygon.ts"), "utf8"), "SHAPE_PATHS");
const html = readFileSync(here("./material-shapes-demo.tpl.html"), "utf8")
  .replace("/*LIB*/", () => lib)
  .replace("/*DATA*/", () => `const DATA = ${data};\nconst OLD = ${old};`);
writeFileSync(here("../../../test-material-shapes.html"), html);
console.log(`test-material-shapes.html ${(html.length / 1024).toFixed(0)} KB`);
