// Derives public/swf/inventory-transparent.swf from the original inventory.swf (which stays unchanged).
// The only change: the exported sprite "mcBg" (character 272), a full-stage #faf8c3 rectangle the inventory
// script attaches at depth 0 as a backdrop, is emptied. Nothing else in the movie reads it, so the inventory
// renders the same on a transparent background (with Ruffle's wmode=transparent).
// Run: node apps/web/scripts/derive-inventory.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/swf");
const src = readFileSync(join(dir, "inventory.swf"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const ORIGINAL = "4472050814fe6b7e1b05f21cc9da2b5e27958c0744056e1c93737e4bab39caac";
if (sha(src) !== ORIGINAL) throw new Error("inventory.swf is not the expected original; refusing to derive");
if (src.toString("latin1", 0, 3) !== "CWS") throw new Error("expected a zlib-compressed SWF");

const body = inflateSync(src.subarray(8));
// DefineSprite(272), long tag header ff 09 + len 16: id 10 01, 1 frame, PlaceObject2(shape 271, depth 1), ShowFrame, End
const before = Buffer.from("ff09" + "10000000" + "10010100" + "86060601000f0100" + "4000" + "0000", "hex");
// the same sprite without the PlaceObject2 (len 8)
const after = Buffer.from("ff09" + "08000000" + "10010100" + "4000" + "0000", "hex");
const at = body.indexOf(before);
if (at < 0 || body.indexOf(before, at + 1) >= 0) throw new Error("mcBg sprite not found exactly once");
const patched = Buffer.concat([body.subarray(0, at), after, body.subarray(at + before.length)]);

const header = Buffer.from(src.subarray(0, 8));
header.writeUInt32LE(patched.length + 8, 4);
const out = Buffer.concat([header, deflateSync(patched, { level: 9 })]);
writeFileSync(join(dir, "inventory-transparent.swf"), out);
console.log("inventory-transparent.swf", out.length, "bytes, sha256", sha(out));
