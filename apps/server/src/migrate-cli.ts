// npm run migrate -w @mybrute/server   (uses DATABASE_URL)
import { createPool } from "./db";
import { migrate } from "./migrate";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the database to migrate.");
const db = createPool(process.env.DATABASE_URL);
const applied = await migrate(db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Already up to date.");
await db.end();
