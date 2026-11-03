import type { Db } from "./db";
import { badRequest, conflict, notFound } from "./errors";

const MAX_SAVES = 100;
const MAX_BYTES = 450_000;
const label = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) throw badRequest("Give the tournament a name.");
  return value.trim().slice(0, 80);
};
const idParam = (id: string) => { if (!/^\d{1,18}$/.test(id)) throw notFound(); return id; };

function cleanTournament(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("That isn't a tournament.");
  const tournament = value as Record<string, unknown>;
  if (typeof tournament.name !== "string" || !["single", "double", "round-robin", "mlb", "ucl"].includes(String(tournament.format))
    || !Array.isArray(tournament.entrants) || tournament.entrants.length < 2 || tournament.entrants.length > 64
    || !Array.isArray(tournament.matches) || tournament.matches.length > 1000) throw badRequest("That isn't a valid tournament.");
  const serialized = JSON.stringify(tournament);
  if (serialized.length > MAX_BYTES) throw badRequest("This tournament is too large to save.");
  return tournament;
}

export async function listTournaments(db: Db, userId: string) {
  const result = await db.query("select id::text as key, label, tournament, created_at as \"savedAt\" from tournament_saves where user_id = $1 order by created_at desc", [userId]);
  return { items: result.rows };
}

export async function saveTournament(db: Db, userId: string, body: unknown, id?: string) {
  const input = (body ?? {}) as Record<string, unknown>;
  const clean = cleanTournament(input.tournament);
  const saveLabel = label(input.label);
  if (id) {
    const result = await db.query(
      "update tournament_saves set label = $1, tournament = $2, created_at = now() where id = $3 and user_id = $4 returning id::text as key, label, tournament, created_at as \"savedAt\"",
      [saveLabel, clean, idParam(id), userId],
    );
    if (!result.rows[0]) throw notFound();
    return { item: result.rows[0] };
  }
  const count = Number((await db.query<{ c: string }>("select count(*) c from tournament_saves where user_id = $1", [userId])).rows[0].c);
  if (count >= MAX_SAVES) throw conflict(`You can keep up to ${MAX_SAVES} tournaments. Delete some to make room.`);
  const result = await db.query(
    "insert into tournament_saves (user_id, label, tournament) values ($1, $2, $3) returning id::text as key, label, tournament, created_at as \"savedAt\"",
    [userId, saveLabel, clean],
  );
  return { item: result.rows[0] };
}

export async function deleteTournament(db: Db, userId: string, id: string) {
  await db.query("delete from tournament_saves where id = $1 and user_id = $2", [idParam(id), userId]);
  return { ok: true };
}
