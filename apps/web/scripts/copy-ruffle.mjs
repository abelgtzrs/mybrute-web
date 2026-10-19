// Self-hosts the pinned Ruffle build: copies node_modules/@ruffle-rs/ruffle into public/ruffle,
// so the app never depends on an unpinned CDN. public/ruffle is gitignored.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let pkgDir;
try {
  pkgDir = dirname(require.resolve("@ruffle-rs/ruffle/package.json"));
} catch {
  console.warn("copy-ruffle: @ruffle-rs/ruffle is not installed yet; skipping");
  process.exit(0);
}
const out = join(here, "../public/ruffle");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
if (existsSync(join(out, "VERSION")) && readFileSync(join(out, "VERSION"), "utf8") === version) process.exit(0);
mkdirSync(out, { recursive: true });
cpSync(pkgDir, out, { recursive: true, filter: (src) => !src.endsWith(".map") });
writeFileSync(join(out, "VERSION"), version);
console.log("copy-ruffle: Ruffle", version, "-> public/ruffle");
