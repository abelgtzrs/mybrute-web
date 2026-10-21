// Copies everything the native app (labrute-native) needs from this repo: the original
// engine scripts, the Flash SWFs and the Ruffle player. Also writes assets/SOURCE.txt
// (which commit it came from) and assets.qrc (the list of files Qt embeds).
// It must run from a clean git tree so SOURCE.txt really names what was copied.
// Usage: npm run export-native -w @mybrute/engine -- <path-to-labrute-native> [--allow-dirty]
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BONUSES } from "../src/generated/bonuses.js";
import { BONUS_NAMES } from "../src/generated/names.ts";
import { writeFixtures } from "./native-fixtures.ts";

const here = dirname(fileURLToPath(import.meta.url));
const engineDir = join(here, "..");
const repoRoot = join(engineDir, "../..");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Lists every file under assets/ as a Qt resource (prefix /assets, so ":/assets/engine/glad.js").
function writeQrc(target: string): void {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(relative(join(target, "assets"), full).replaceAll("\\", "/"));
    }
  };
  walk(join(target, "assets"));
  files.sort();
  const lines = files.map((f) => `        <file alias="${f}">assets/${f}</file>`);
  const qrc = `<RCC>\n    <qresource prefix="/assets">\n${lines.join("\n")}\n    </qresource>\n</RCC>\n`;
  writeFileSync(join(target, "assets.qrc"), qrc);
}

function main(): void {
  const args = process.argv.slice(2);
  const allowDirty = args.includes("--allow-dirty");
  const targetArg = args.find((a) => !a.startsWith("--"));
  if (!targetArg) fail("usage: export-native <path-to-labrute-native> [--allow-dirty]");
  // npm runs us from packages/engine, so resolve the path from where the user typed it.
  const target = resolve(process.env.INIT_CWD ?? process.cwd(), targetArg);

  // We delete folders in the target, so make sure it really is labrute-native.
  const cmake = join(target, "CMakeLists.txt");
  if (!existsSync(cmake) || !readFileSync(cmake, "utf8").includes("project(labrute-native")) {
    fail(`${target} is not a labrute-native checkout (no CMakeLists.txt with project(labrute-native))`);
  }

  const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: repoRoot, encoding: "utf8" }).trim();
  if (!allowDirty && git("status --porcelain") !== "") {
    fail("mybrute-plus has uncommitted changes; commit them or pass --allow-dirty");
  }

  // Start from empty folders so files removed upstream disappear here too.
  const assets = join(target, "assets");
  for (const sub of ["engine", "swf", "ruffle"]) {
    rmSync(join(assets, sub), { recursive: true, force: true });
    mkdirSync(join(assets, sub), { recursive: true });
  }

  for (const f of ["glad.js", "fight.js", "labrute.js", "fightlog.js", "inventory.js"]) {
    cpSync(join(engineDir, "vendor", f), join(assets, "engine", f));
  }
  writeFileSync(join(assets, "engine/bonuses.json"), JSON.stringify(BONUSES, null, 1));
  writeFileSync(join(assets, "engine/names.json"), JSON.stringify(BONUS_NAMES, null, 1));

  const web = join(repoRoot, "apps/web/public");
  for (const f of ["client.swf", "perso.swf", "mini_perso.swf", "inventory.swf", "inventory-transparent.swf"]) {
    cpSync(join(web, "swf", f), join(assets, "swf", f));
  }
  cpSync(join(web, "ruffle"), join(assets, "ruffle"), { recursive: true });

  writeFileSync(join(assets, "SOURCE.txt"), `mybrute-plus ${git("rev-parse HEAD")}\n${new Date().toISOString()}\n`);
  writeQrc(target);
  writeFixtures(target);
  console.log(`exported to ${assets}`);
}

main();
