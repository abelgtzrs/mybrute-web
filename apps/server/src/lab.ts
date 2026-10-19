// Laboratory saves for signed-in players. Lab data never touches Classic brutes.
import { isValidGfx, isValidSeedId } from "@mybrute/engine";
import type { Db } from "./db";
import { badRequest, conflict, notFound } from "./errors";

const MAX_ITEMS = 300;
const MAX_PARAMS = 40_000;

const label = (v: unknown) => {
  if (typeof v !== "string" || !v.trim()) throw badRequest("Give it a name.");
  return v.trim().slice(0, 80);
};
const idParam = (id: string) => { if (!/^\d{1,18}$/.test(id)) throw notFound(); return id; };

async function checkRoom(db: Db, table: "lab_payloads" | "lab_brutes", userId: string) {
  const n = Number((await db.query<{ c: string }>(`select count(*) c from ${table} where user_id = $1`, [userId])).rows[0].c);
  if (n >= MAX_ITEMS) throw conflict(`You can keep up to ${MAX_ITEMS} saves here. Delete some to make room.`);
}

export async function listPayloads(db: Db, userId: string) {
  const r = await db.query("select id::text as key, label, params, created_at as \"savedAt\" from lab_payloads where user_id = $1 order by created_at desc", [userId]);
  return { items: r.rows };
}
export async function savePayload(db: Db, userId: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.params !== "string" || !b.params.includes("data=") || b.params.length > MAX_PARAMS) throw badRequest("That isn't a fight payload.");
  await checkRoom(db, "lab_payloads", userId);
  const r = await db.query("insert into lab_payloads (user_id, label, params) values ($1, $2, $3) returning id::text as key, label, params, created_at as \"savedAt\"",
    [userId, label(b.label), b.params]);
  return { item: r.rows[0] };
}
export async function deletePayload(db: Db, userId: string, id: string) {
  await db.query("delete from lab_payloads where id = $1 and user_id = $2", [idParam(id), userId]);
  return { ok: true };
}

export async function listLabBrutes(db: Db, userId: string) {
  const r = await db.query("select id::text as key, label, brute, created_at as \"savedAt\" from lab_brutes where user_id = $1 order by created_at desc", [userId]);
  return { items: r.rows };
}
export async function saveLabBrute(db: Db, userId: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const br = b.brute as Record<string, unknown> | undefined;
  const ok = br && typeof br.name === "string" && br.name.length <= 80 && isValidSeedId(br.id) && (br.team === 0 || br.team === 1)
    && Number.isInteger(br.levelUps) && (br.levelUps as number) >= 0 && (br.levelUps as number) < 500 && isValidGfx(br.gfx)
    && Array.isArray(br.choices) && br.choices.length <= 500 && br.choices.every((c) => c === 0 || c === 1)
    && (br.avoid === undefined || (Array.isArray(br.avoid) && br.avoid.length <= 100 && br.avoid.every((a) => typeof a === "string" && a.length <= 60)));
  if (!ok) throw badRequest("That isn't a valid Lab brute.");
  await checkRoom(db, "lab_brutes", userId);
  const clean = { name: br.name, id: br.id, team: br.team, levelUps: br.levelUps, gfx: br.gfx, choices: br.choices, ...(br.avoid ? { avoid: br.avoid } : {}) };
  const r = await db.query("insert into lab_brutes (user_id, label, brute) values ($1, $2, $3) returning id::text as key, label, brute, created_at as \"savedAt\"",
    [userId, label(b.label), clean]);
  return { item: r.rows[0] };
}
export async function deleteLabBrute(db: Db, userId: string, id: string) {
  await db.query("delete from lab_brutes where id = $1 and user_id = $2", [idParam(id), userId]);
  return { ok: true };
}
