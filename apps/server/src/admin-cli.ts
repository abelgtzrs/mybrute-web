// Grants or removes admin rights from the command line (the first admin has to come from somewhere).
//   npm run admin -w @mybrute/server -- grant <username>
//   npm run admin -w @mybrute/server -- revoke <username>
//   npm run admin -w @mybrute/server -- list
// Uses DATABASE_URL, or the embedded development database when it's unset.
import { config } from "./config";
import { createPool } from "./db";
import { migrate } from "./migrate";

const [command, username] = process.argv.slice(2);
if (!["grant", "revoke", "list"].includes(command ?? "") || (command !== "list" && !username)) {
  console.error("Usage: npm run admin -w @mybrute/server -- grant <username> | revoke <username> | list");
  process.exit(1);
}

let url = config.databaseUrl;
let stop: (() => Promise<void>) | null = null;
if (!url) {
  const { startDevDatabase } = await import("./devdb");
  const dev = await startDevDatabase();
  url = dev.url;
  if (!dev.reused) stop = dev.stop; // leave a database that the dev server is using running
}
const db = createPool(url);
try {
  await migrate(db);
  if (command === "list") {
    const r = await db.query<{ username: string }>("select username from users where role = 'admin' order by lower(username)");
    console.log(r.rows.length ? r.rows.map((x) => x.username).join("\n") : "No admins yet.");
  } else {
    const role = command === "grant" ? "admin" : "player";
    const r = await db.query<{ username: string }>(
      "update users set role = $2 where lower(username) = lower($1) returning username", [username, role]);
    if (!r.rows[0]) { console.error(`There's no account called ${username}. Register it first.`); process.exitCode = 1; }
    else console.log(role === "admin" ? `${r.rows[0].username} is now an admin.` : `${r.rows[0].username} is no longer an admin.`);
  }
} finally {
  await db.end();
  if (stop) await stop();
}
