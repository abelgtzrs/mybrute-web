// Runs after `vite build`: writes a .br and a .gz copy next to each text/wasm file in dist,
// so the server can send them compressed without compressing on every request.
// The big one is Ruffle's .wasm: about 14 MB raw, 3.4 MB as brotli.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");
// .swf is left out: SWFs are already zlib-compressed inside
const worthIt = /\.(wasm|js|mjs|css|html|svg|json|txt)$/;

let raw = 0, br = 0;
for (const name of readdirSync(dist, { recursive: true })) {
  const file = join(dist, name);
  if (!worthIt.test(file) || statSync(file).size < 1024) continue;
  const data = readFileSync(file);
  const b = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
  const g = gzipSync(data, { level: 9 });
  if (b.length < data.length) writeFileSync(file + ".br", b);
  if (g.length < data.length) writeFileSync(file + ".gz", g);
  raw += data.length; br += Math.min(b.length, data.length);
}
console.log(`compress-dist: ${(raw / 1e6).toFixed(1)} MB -> ${(br / 1e6).toFixed(1)} MB as brotli`);
