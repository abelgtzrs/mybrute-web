// npm run dev: starts the API server (with its embedded Postgres) and the Vite web app together.
import { spawn } from "node:child_process";

const procs = [
  ["server", ["run", "dev", "-w", "@mybrute/server"]],
  ["web", ["run", "dev", "-w", "@mybrute/web"]],
].map(([name, args]) => {
  const p = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  const tag = `[${name}] `;
  const out = (s) => (d) => s.write(d.toString().split(/\r?\n/).filter(Boolean).map((l) => tag + l).join("\n") + "\n");
  p.stdout.on("data", out(process.stdout));
  p.stderr.on("data", out(process.stderr));
  p.on("exit", (code) => { console.log(`${tag}exited with ${code}`); stop(); });
  return p;
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) {
    // on Windows npm runs through a shell; end the whole tree so Vite and the API don't linger
    if (process.platform === "win32" && p.pid) spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    else p.kill();
  }
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
