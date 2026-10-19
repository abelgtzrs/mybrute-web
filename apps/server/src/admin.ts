// Admin tools for Classic mode. Every route needs an admin session, and every change is written to admin_log
// in the same transaction as the change. Admins correct state (XP, daily fights, the last level-up, owners,
// names, limits); they never invent stats or level-up choices: those still come only from the original engine.
import { bitsToHex, displayLevel, hexToChoices, type LevelOption } from "@mybrute/engine";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { hashPassword, type Role, type SessionUser } from "./auth";
import * as classic from "./classic";
import { isUniqueViolation, withTx, type Db, type Tx } from "./db";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "./errors";
import { bruteNameProblem, classicDay, DAILY_TIME_ZONE, fightsUsedToday, isPending, PASSWORD_RULES, requiredXp } from "./rules";

const PAGE_SIZE = 25;
const LOG_PAGE_SIZE = 50;
export const LIMITS = { maxBrutes: 1000, dailyFights: 1000, xp: 1_000_000, reason: 200 } as const;

export function requireAdmin(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  if (req.user.role !== "admin") throw forbidden("Only admins can do that.");
  return req.user;
}

const isId = (s: string) => /^\d{1,18}$/.test(s);
const pageOf = (p: unknown) => Math.max(1, Math.floor(Number(p) || 1));
const textOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const body = (b: unknown) => (b ?? {}) as Record<string, unknown>;
/** midnight today, Bordeaux time, as a timestamptz expression */
const DAY_START = `(date_trunc('day', now() at time zone '${DAILY_TIME_ZONE}') at time zone '${DAILY_TIME_ZONE}')`;

interface Target { kind: "user" | "brute" | "settings"; id: string | null; label: string }
async function audit(tx: Tx, admin: SessionUser, action: string, t: Target, detail: Record<string, unknown> = {}) {
  await tx.query(
    "insert into admin_log (admin_id, admin_name, action, target_kind, target_id, target_label, detail) values ($1, $2, $3, $4, $5, $6, $7)",
    [admin.id, admin.username, action, t.kind, t.id, t.label, detail]);
}

// ---------------------------------------------------------------- overview

export async function overview(db: Db) {
  const counts = (await db.query(
    `select (select count(*) from users)::int users,
            (select count(*) from users where role = 'admin')::int admins,
            (select count(*) from users where suspended_at is not null)::int suspended,
            (select count(*) from users where created_at > now() - interval '7 days')::int "newUsers",
            (select count(*) from brutes)::int brutes,
            (select count(*) from brutes where pending_level_up)::int "pendingLevelUps",
            (select count(*) from fights)::int fights,
            (select count(*) from fights where created_at >= ${DAY_START})::int "fightsToday",
            (select count(*) from level_ups)::int "levelUps",
            (select count(*) from sessions where expires_at > now())::int sessions`)).rows[0];
  const today = (await db.query<{ result: string; n: number }>(
    `select result, count(*)::int n from fights where created_at >= ${DAY_START} group by result`)).rows;
  const top = (await db.query(
    `select b.id, b.name, b.gfx, b.level_ups, b.xp, u.id owner_id, u.username owner
       from brutes b join users u on u.id = b.owner_id order by b.level_ups desc, b.xp desc, b.id limit 5`)).rows;
  return {
    counts,
    resultsToday: Object.fromEntries(["win", "loss", "draw"].map((r) => [r, today.find((t) => t.result === r)?.n ?? 0])),
    topBrutes: top.map((b) => ({ id: b.id, name: b.name, gfx: b.gfx, level: displayLevel(b.level_ups), xp: b.xp, owner: { id: b.owner_id, username: b.owner } })),
    settings: await classic.getSettings(db),
    recentLog: (await listLog(db, { page: 1, pageSize: 8 })).entries,
    day: classicDay(),
  };
}

// ---------------------------------------------------------------- players

interface UserRow {
  id: string; username: string; role: Role; max_brutes: number | null; created_at: Date; last_login_at: Date | null;
  suspended_at: Date | null; suspend_reason: string | null; brutes: number; fights: number; total?: number;
}
const USER_COLUMNS = `u.id, u.username, u.role, u.max_brutes, u.created_at, u.last_login_at, u.suspended_at, u.suspend_reason,
  (select count(*) from brutes b where b.owner_id = u.id)::int brutes,
  (select count(*) from fights f join brutes b on b.id = f.brute_id where b.owner_id = u.id)::int fights`;
const userOut = (u: UserRow) => ({
  id: u.id, username: u.username, role: u.role, maxBrutes: u.max_brutes, createdAt: u.created_at, lastLoginAt: u.last_login_at,
  suspended: u.suspended_at ? { at: u.suspended_at, reason: u.suspend_reason } : null, brutes: u.brutes, fights: u.fights,
});

export async function listUsers(db: Db, q: { q?: string; filter?: string; page?: unknown }) {
  const page = pageOf(q.page);
  const filter = q.filter === "admin" || q.filter === "suspended" ? q.filter : null;
  const r = await db.query<UserRow>(
    `select ${USER_COLUMNS}, count(*) over ()::int total from users u
      where ($1::text is null or strpos(lower(u.username), lower($1)) > 0)
        and ($2::text is null or ($2 = 'admin' and u.role = 'admin') or ($2 = 'suspended' and u.suspended_at is not null))
      order by u.created_at desc, u.id desc limit $3 offset $4`,
    [textOrNull(q.q), filter, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return { total: r.rows[0]?.total ?? 0, page, pageSize: PAGE_SIZE, users: r.rows.map(userOut) };
}

async function userRow(db: Db | Tx, id: string, lock = false): Promise<UserRow> {
  if (!isId(id)) throw notFound("That player doesn't exist.");
  // the brute and fight counts are subqueries, so lock the users row on its own first
  if (lock) await db.query("select 1 from users where id = $1 for update", [id]);
  const u = (await db.query<UserRow>(`select ${USER_COLUMNS} from users u where u.id = $1`, [id])).rows[0];
  if (!u) throw notFound("That player doesn't exist.");
  return u;
}

export async function getUser(db: Db, id: string) {
  const u = await userRow(db, id);
  const extra = (await db.query(
    `select (select count(*) from sessions where user_id = $1 and expires_at > now())::int sessions,
            (select count(*) from lab_payloads where user_id = $1)::int "labPayloads",
            (select count(*) from lab_brutes where user_id = $1)::int "labBrutes"`, [id])).rows[0];
  const { brutes, maxBrutes } = await classic.listBrutes(db, id);
  return { user: { ...userOut(u), ...extra, effectiveMaxBrutes: maxBrutes }, brutes, log: (await listLog(db, { kind: "user", targetId: id, pageSize: 20 })).entries };
}

/** Runs an admin change to a player in one transaction, with the player's row locked. */
function onUser<T>(db: Db, admin: SessionUser, id: string, fn: (tx: Tx, u: UserRow) => Promise<T>) {
  return withTx(db, async (tx) => fn(tx, await userRow(tx, id, true)));
}
const userTarget = (u: UserRow): Target => ({ kind: "user", id: u.id, label: u.username });
function notSelf(admin: SessionUser, u: UserRow, what: string) {
  if (admin.id === u.id) throw conflict(`You can't ${what} your own account. Ask another admin.`, "self");
}

export function setRole(db: Db, admin: SessionUser, id: string, b: unknown) {
  const role = body(b).role;
  if (role !== "player" && role !== "admin") throw badRequest("The role is player or admin.");
  return onUser(db, admin, id, async (tx, u) => {
    notSelf(admin, u, "change the role of");
    if (u.role === role) return { ok: true, changed: false };
    if (role === "admin" && u.suspended_at) throw conflict("Lift the suspension before making this player an admin.", "suspended");
    await tx.query("update users set role = $2 where id = $1", [u.id, role]);
    await audit(tx, admin, role === "admin" ? "user.grant_admin" : "user.revoke_admin", userTarget(u));
    return { ok: true, changed: true };
  });
}

export function suspendUser(db: Db, admin: SessionUser, id: string, b: unknown) {
  const reason = textOrNull(body(b).reason);
  if (reason && reason.length > LIMITS.reason) throw badRequest(`Keep the reason under ${LIMITS.reason} characters.`);
  return onUser(db, admin, id, async (tx, u) => {
    notSelf(admin, u, "suspend");
    if (u.role === "admin") throw conflict("Remove this player's admin role before suspending them.", "is_admin");
    await tx.query("update users set suspended_at = coalesce(suspended_at, now()), suspend_reason = $2 where id = $1", [u.id, reason]);
    const ended = (await tx.query("delete from sessions where user_id = $1", [u.id])).rowCount;
    await audit(tx, admin, "user.suspend", userTarget(u), { reason, sessionsEnded: ended });
    return { ok: true };
  });
}

export function unsuspendUser(db: Db, admin: SessionUser, id: string) {
  return onUser(db, admin, id, async (tx, u) => {
    if (!u.suspended_at) return { ok: true, changed: false };
    await tx.query("update users set suspended_at = null, suspend_reason = null where id = $1", [u.id]);
    await audit(tx, admin, "user.unsuspend", userTarget(u), { reason: u.suspend_reason });
    return { ok: true, changed: true };
  });
}

export function setUserLimit(db: Db, admin: SessionUser, id: string, b: unknown) {
  const v = body(b).maxBrutes;
  if (v !== null && !(Number.isInteger(v) && (v as number) >= 0 && (v as number) <= LIMITS.maxBrutes)) {
    throw badRequest(`The brute limit is a whole number from 0 to ${LIMITS.maxBrutes}, or empty for the default.`);
  }
  return onUser(db, admin, id, async (tx, u) => {
    await tx.query("update users set max_brutes = $2 where id = $1", [u.id, v]);
    await audit(tx, admin, "user.set_limit", userTarget(u), { from: u.max_brutes, to: v });
    return { ok: true };
  });
}

export async function resetPassword(db: Db, admin: SessionUser, id: string, b: unknown) {
  const pw = body(b).password;
  if (typeof pw !== "string" || pw.length < PASSWORD_RULES.min || pw.length > PASSWORD_RULES.max) {
    throw badRequest(`Passwords are at least ${PASSWORD_RULES.min} characters.`);
  }
  const hash = await hashPassword(pw);
  return onUser(db, admin, id, async (tx, u) => {
    notSelf(admin, u, "reset the password of");
    await tx.query("update users set password_hash = $2 where id = $1", [u.id, hash]);
    const ended = (await tx.query("delete from sessions where user_id = $1", [u.id])).rowCount;
    await audit(tx, admin, "user.reset_password", userTarget(u), { sessionsEnded: ended });
    return { ok: true };
  });
}

export function signOutUser(db: Db, admin: SessionUser, id: string) {
  return onUser(db, admin, id, async (tx, u) => {
    notSelf(admin, u, "sign out");
    const ended = (await tx.query("delete from sessions where user_id = $1", [u.id])).rowCount;
    await audit(tx, admin, "user.sign_out", userTarget(u), { sessionsEnded: ended });
    return { ok: true, sessionsEnded: ended };
  });
}

export function deleteUser(db: Db, admin: SessionUser, id: string) {
  return onUser(db, admin, id, async (tx, u) => {
    notSelf(admin, u, "delete");
    if (u.role === "admin") throw conflict("Remove this player's admin role before deleting the account.", "is_admin");
    await audit(tx, admin, "user.delete", userTarget(u), { brutes: u.brutes, fights: u.fights });
    await tx.query("delete from users where id = $1", [u.id]);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- brutes

interface BruteRow {
  id: string; owner_id: string; owner: string; name: string; seed_id: number; gfx: string; level_ups: number; bits: string;
  xp: number; pending_level_up: boolean; fights_day: string | null; fights_used: number; created_at: Date; fights: number; total?: number;
}
const BRUTE_SORTS: Record<string, string> = {
  new: "b.created_at desc, b.id desc",
  level: "b.level_ups desc, b.xp desc, b.id",
  name: "lower(b.name), b.id",
};

export async function listBrutes(db: Db, q: { q?: string; filter?: string; sort?: string; owner?: string; page?: unknown }) {
  const page = pageOf(q.page);
  const owner = q.owner && isId(q.owner) ? q.owner : null;
  const r = await db.query<BruteRow>(
    `select b.*, u.username owner, (select count(*) from fights f where f.brute_id = b.id)::int fights, count(*) over ()::int total
       from brutes b join users u on u.id = b.owner_id
      where ($1::text is null or strpos(lower(b.name), lower($1)) > 0 or b.seed_id::text = $1 or strpos(lower(u.username), lower($1)) > 0)
        and ($2::bigint is null or b.owner_id = $2)
        and ($3::text is null or ($3 = 'pending' and b.pending_level_up))
      order by ${BRUTE_SORTS[q.sort ?? ""] ?? BRUTE_SORTS.new} limit $4 offset $5`,
    [textOrNull(q.q), owner, q.filter === "pending" ? "pending" : null, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  const s = await classic.getSettings(db);
  return {
    total: r.rows[0]?.total ?? 0, page, pageSize: PAGE_SIZE,
    brutes: r.rows.map((b) => {
      const level = displayLevel(b.level_ups);
      return {
        id: b.id, name: b.name, seedId: b.seed_id, gfx: b.gfx, level, xp: b.xp, xpRequired: requiredXp(level),
        pendingLevelUp: b.pending_level_up, fightsLeft: Math.max(0, s.dailyFights - fightsUsedToday(b.fights_day, b.fights_used)),
        fights: b.fights, createdAt: b.created_at, owner: { id: b.owner_id, username: b.owner },
      };
    }),
  };
}

async function bruteRow(db: Db | Tx, id: string, lock = false): Promise<BruteRow> {
  if (!isId(id)) throw notFound("That brute doesn't exist.");
  if (lock) await db.query("select 1 from brutes where id = $1 for update", [id]);
  const b = (await db.query<BruteRow>(
    `select b.*, u.username owner, (select count(*) from fights f where f.brute_id = b.id)::int fights
       from brutes b join users u on u.id = b.owner_id where b.id = $1`, [id])).rows[0];
  if (!b) throw notFound("That brute doesn't exist.");
  return b;
}

/** The same cell a player sees (built by the same code), plus the owner and the admin log for this brute. */
export async function getBrute(db: Db, id: string) {
  const b = await bruteRow(db, id);
  const cell = await classic.getCell(db, b.owner_id, id);
  return { ...cell, owner: { id: b.owner_id, username: b.owner }, log: (await listLog(db, { kind: "brute", targetId: id, pageSize: 20 })).entries };
}

function onBrute<T>(db: Db, id: string, fn: (tx: Tx, b: BruteRow) => Promise<T>) {
  return withTx(db, async (tx) => fn(tx, await bruteRow(tx, id, true)));
}
const bruteTarget = (b: BruteRow): Target => ({ kind: "brute", id: b.id, label: b.name });

/** Sets XP directly. The level-up flag follows the normal rule: enough XP for the next level means a choice is waiting. */
export function setXp(db: Db, admin: SessionUser, id: string, b: unknown) {
  const xp = body(b).xp;
  if (!Number.isInteger(xp) || (xp as number) < 0 || (xp as number) > LIMITS.xp) throw badRequest(`XP is a whole number from 0 to ${LIMITS.xp.toLocaleString("en")}.`);
  return onBrute(db, id, async (tx, br) => {
    const pending = isPending(xp as number, displayLevel(br.level_ups));
    await tx.query("update brutes set xp = $2, pending_level_up = $3 where id = $1", [br.id, xp, pending]);
    await audit(tx, admin, "brute.set_xp", bruteTarget(br), { from: br.xp, to: xp, pendingLevelUp: pending });
    return { ok: true, pendingLevelUp: pending };
  });
}

export function resetFights(db: Db, admin: SessionUser, id: string) {
  return onBrute(db, id, async (tx, br) => {
    const used = fightsUsedToday(br.fights_day, br.fights_used);
    await tx.query("update brutes set fights_day = $2, fights_used = 0 where id = $1", [br.id, classicDay()]);
    await audit(tx, admin, "brute.reset_fights", bruteTarget(br), { usedBefore: used });
    return { ok: true };
  });
}

export async function renameBrute(db: Db, admin: SessionUser, id: string, b: unknown) {
  const problem = bruteNameProblem(body(b).name);
  if (problem) throw badRequest(problem);
  const name = (body(b).name as string).trim();
  try {
    return await onBrute(db, id, async (tx, br) => {
      if (br.name === name) return { ok: true, changed: false };
      await tx.query("update brutes set name = $2 where id = $1", [br.id, name]);
      await audit(tx, admin, "brute.rename", bruteTarget(br), { from: br.name, to: name });
      return { ok: true, changed: true };
    });
  } catch (e) {
    if (isUniqueViolation(e, "brutes_name_unique")) throw conflict("Another brute already has that name.", "name_taken");
    throw e;
  }
}

/** Moves a brute to another account. Admins may go over the receiving account's brute limit. */
export function transferBrute(db: Db, admin: SessionUser, id: string, b: unknown) {
  const username = textOrNull(body(b).username);
  if (!username) throw badRequest("Enter the username of the new owner.");
  return onBrute(db, id, async (tx, br) => {
    const to = (await tx.query<{ id: string; username: string; suspended_at: Date | null }>(
      "select id, username, suspended_at from users where lower(username) = lower($1) for update", [username])).rows[0];
    if (!to) throw notFound(`There's no player called ${username}.`);
    if (to.suspended_at) throw conflict(`${to.username} is suspended. Lift the suspension first.`, "suspended");
    if (to.id === br.owner_id) return { ok: true, changed: false };
    await tx.query("update brutes set owner_id = $2 where id = $1", [br.id, to.id]);
    await audit(tx, admin, "brute.transfer", bruteTarget(br), { from: br.owner, to: to.username });
    return { ok: true, changed: true };
  });
}

/**
 * Undoes the brute's most recent level-up: the XP it cost comes back and the same two options are offered again.
 * This is exact, because the offers at level-up i depend only on the choices made before i.
 */
export function undoLevelUp(db: Db, admin: SessionUser, id: string) {
  return onBrute(db, id, async (tx, br) => {
    if (br.level_ups === 0) throw conflict("This brute has no level-ups to undo.", "no_level_ups");
    const idx = br.level_ups - 1;
    const last = (await tx.query<{ choice: number; options: [LevelOption, LevelOption]; xp_spent: number }>(
      "select choice, options, xp_spent from level_ups where brute_id = $1 and idx = $2", [br.id, idx])).rows[0];
    const choices = hexToChoices(br.bits, br.level_ups).slice(0, idx);
    const xp = br.xp + (last?.xp_spent ?? requiredXp(displayLevel(idx)));
    await tx.query("delete from level_ups where brute_id = $1 and idx = $2", [br.id, idx]);
    await tx.query("update brutes set level_ups = $2, bits = $3, xp = $4, pending_level_up = $5 where id = $1",
      [br.id, idx, bitsToHex(choices, idx), xp, isPending(xp, displayLevel(idx))]);
    // opponents found at the old level no longer match
    await tx.query("delete from opponent_offers where brute_id = $1 and consumed_at is null", [br.id]);
    await audit(tx, admin, "brute.undo_level_up", bruteTarget(br), { level: idx + 2, undone: last?.options[last.choice]?.text ?? null });
    return { ok: true };
  });
}

export function deleteBrute(db: Db, admin: SessionUser, id: string) {
  return onBrute(db, id, async (tx, br) => {
    await audit(tx, admin, "brute.delete", bruteTarget(br), { owner: br.owner, level: displayLevel(br.level_ups), fights: br.fights });
    await tx.query("delete from brutes where id = $1", [br.id]);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- fights

export async function listFights(db: Db, q: { q?: string; result?: string; brute?: string; page?: unknown }) {
  const page = pageOf(q.page);
  const result = q.result === "win" || q.result === "loss" || q.result === "draw" ? q.result : null;
  const brute = q.brute && isId(q.brute) ? q.brute : null;
  const r = await db.query(
    `select f.id, f.created_at, f.result, f.xp_awarded, f.level_ups, f.events, b.id brute_id, b.name brute_name, u.id owner_id, u.username owner,
            f.spec->'brutes'->1->>'name' opponent, (f.spec->'brutes'->1->>'levelUps')::int opponent_level_ups,
            (f.player_stats->>'totalDamageDealt')::int dealt, (f.player_stats->>'damageReceived')::int taken, count(*) over ()::int total
       from fights f join brutes b on b.id = f.brute_id join users u on u.id = b.owner_id
      where ($1::bigint is null or f.brute_id = $1) and ($2::text is null or f.result = $2)
        and ($3::text is null or strpos(lower(b.name), lower($3)) > 0 or strpos(lower(u.username), lower($3)) > 0 or f.spec->'brutes'->1->>'name' = $3)
      order by f.created_at desc, f.id desc limit $4 offset $5`,
    [brute, result, textOrNull(q.q), PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return {
    total: r.rows[0]?.total ?? 0, page, pageSize: PAGE_SIZE,
    fights: r.rows.map((f) => ({
      id: f.id, createdAt: f.created_at, result: f.result, xpAwarded: f.xp_awarded, events: f.events, level: displayLevel(f.level_ups),
      brute: { id: f.brute_id, name: f.brute_name }, owner: { id: f.owner_id, username: f.owner },
      opponent: { name: f.opponent, level: displayLevel(f.opponent_level_ups) }, damageDealt: f.dealt, damageReceived: f.taken,
    })),
  };
}

export async function getFight(db: Db, id: string) {
  if (!isId(id)) throw notFound("That fight doesn't exist.");
  const f = (await db.query<{ owner_id: string; username: string }>(
    "select u.id owner_id, u.username from fights f join brutes b on b.id = f.brute_id join users u on u.id = b.owner_id where f.id = $1", [id])).rows[0];
  if (!f) throw notFound("That fight doesn't exist.");
  return { ...(await classic.getFight(db, f.owner_id, id)), owner: { id: f.owner_id, username: f.username } };
}

// ---------------------------------------------------------------- settings

export async function setSettings(db: Db, admin: SessionUser, b: unknown) {
  const input = body(b);
  const changes: [string, string, number][] = [];
  const check = (field: string, key: string, max: number, label: string) => {
    const v = input[field];
    if (v === undefined) return;
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) throw badRequest(`${label} is a whole number from 0 to ${max}.`);
    changes.push([field, key, v as number]);
  };
  check("maxBrutesDefault", "max_brutes_default", LIMITS.maxBrutes, "The brute limit");
  check("dailyFights", "daily_fights", LIMITS.dailyFights, "Daily fights");
  return withTx(db, async (tx) => {
    await tx.query("select 1 from settings for update");
    const before = await classic.getSettings(tx);
    for (const [field, key, v] of changes) {
      if (before[field as keyof typeof before] === v) continue;
      await tx.query("insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [key, JSON.stringify(v)]);
      await audit(tx, admin, "settings.set", { kind: "settings", id: key, label: key }, { from: before[field as keyof typeof before], to: v });
    }
    return { settings: await classic.getSettings(tx) };
  });
}

// ---------------------------------------------------------------- log

export async function listLog(db: Db, q: { page?: unknown; kind?: string; targetId?: string; pageSize?: number }) {
  const page = pageOf(q.page);
  const pageSize = q.pageSize ?? LOG_PAGE_SIZE;
  const kind = q.kind === "user" || q.kind === "brute" || q.kind === "settings" ? q.kind : null;
  const r = await db.query(
    `select *, count(*) over ()::int total from admin_log
      where ($1::text is null or target_kind = $1) and ($2::text is null or target_id = $2)
      order by created_at desc, id desc limit $3 offset $4`, [kind, q.targetId ?? null, pageSize, (page - 1) * pageSize]);
  return {
    total: r.rows[0]?.total ?? 0, page, pageSize,
    entries: r.rows.map((e) => ({
      id: e.id, at: e.created_at, admin: { id: e.admin_id, username: e.admin_name }, action: e.action,
      target: { kind: e.target_kind, id: e.target_id, label: e.target_label }, detail: e.detail,
    })),
  };
}

// ---------------------------------------------------------------- routes

export function adminRoutes(app: FastifyInstance, db: Db) {
  type P = { Params: { id: string } };
  type Q = { Querystring: Record<string, string | undefined> };
  // every admin route checks the session first, before reading any input
  app.addHook("preHandler", async (req) => { if (req.url.startsWith("/api/admin/")) requireAdmin(req); });
  const me = (req: FastifyRequest) => requireAdmin(req);

  app.get("/api/admin/overview", async () => overview(db));

  app.get<Q>("/api/admin/users", async (req) => listUsers(db, req.query));
  app.get<P>("/api/admin/users/:id", async (req) => getUser(db, req.params.id));
  app.post<P>("/api/admin/users/:id/role", async (req) => setRole(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/users/:id/suspend", async (req) => suspendUser(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/users/:id/unsuspend", async (req) => unsuspendUser(db, me(req), req.params.id));
  app.post<P>("/api/admin/users/:id/limit", async (req) => setUserLimit(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/users/:id/password", async (req) => resetPassword(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/users/:id/sign-out", async (req) => signOutUser(db, me(req), req.params.id));
  app.delete<P>("/api/admin/users/:id", async (req) => deleteUser(db, me(req), req.params.id));

  app.get<Q>("/api/admin/brutes", async (req) => listBrutes(db, req.query));
  app.get<P>("/api/admin/brutes/:id", async (req) => getBrute(db, req.params.id));
  app.post<P>("/api/admin/brutes/:id/xp", async (req) => setXp(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/brutes/:id/reset-fights", async (req) => resetFights(db, me(req), req.params.id));
  app.post<P>("/api/admin/brutes/:id/rename", async (req) => renameBrute(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/brutes/:id/transfer", async (req) => transferBrute(db, me(req), req.params.id, req.body));
  app.post<P>("/api/admin/brutes/:id/undo-level-up", async (req) => undoLevelUp(db, me(req), req.params.id));
  app.delete<P>("/api/admin/brutes/:id", async (req) => deleteBrute(db, me(req), req.params.id));

  app.get<Q>("/api/admin/fights", async (req) => listFights(db, req.query));
  app.get<P>("/api/admin/fights/:id", async (req) => getFight(db, req.params.id));

  app.get("/api/admin/settings", async () => ({ settings: await classic.getSettings(db), limits: LIMITS }));
  app.post("/api/admin/settings", async (req) => setSettings(db, me(req), req.body));

  app.get<Q>("/api/admin/log", async (req) => listLog(db, { page: req.query.page, kind: req.query.kind }));
}
