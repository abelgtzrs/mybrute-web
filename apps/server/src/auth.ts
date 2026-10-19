// Accounts and sessions. Passwords: scrypt (Node built-in). Sessions: random 32-byte tokens in an httpOnly,
// SameSite=Lax cookie; only their SHA-256 is stored. State-changing API calls must carry the X-MyBrute header,
// which cross-site forms can't send and cross-site scripts can't add without a CORS preflight we never allow.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";
import { isUniqueViolation, withTx, type Db } from "./db";
import { badRequest, conflict, forbidden, tooMany, unauthorized } from "./errors";
import { PASSWORD_RULES, USERNAME_RULES } from "./rules";

export type Role = "player" | "admin";
export interface SessionUser { id: string; username: string; role: Role }
declare module "fastify" {
  interface FastifyRequest { user: SessionUser | null }
}

export const SESSION_COOKIE = "mb_session";
export const CSRF_HEADER = "x-mybrute";

// ---- passwords ----
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const scrypt = (pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, keylen, opts, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, key] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
  return timingSafeEqual(actual, expected);
}

// ---- sessions ----
const tokenHash = (token: string) => createHash("sha256").update(token).digest();

async function createSession(db: Db, userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  await db.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [tokenHash(token), userId, expires]);
  return { token, expires };
}

function setSessionCookie(reply: FastifyReply, token: string, expires: Date) {
  reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/", expires });
}

// ---- login throttling (per client address + username, in memory) ----
const attempts = new Map<string, { count: number; until: number }>();
const LOGIN_WINDOW_MS = 15 * 60_000, LOGIN_MAX = 10;
function checkThrottle(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.count >= LOGIN_MAX) throw tooMany("Too many sign-in attempts. Wait 15 minutes and try again.");
}
function recordFailure(key: string) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + LOGIN_WINDOW_MS });
  else a.count++;
}

function readCredentials(body: unknown): { username: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.username !== "string" || typeof b.password !== "string") throw badRequest("Enter a username and a password.");
  return { username: b.username.trim(), password: b.password };
}

export async function authPlugin(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    if (!req.url.startsWith("/api/")) return;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers[CSRF_HEADER] !== "1") {
      throw forbidden("This request is missing the MyBrute++ header.");
    }
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    // suspending drops the account's sessions; the check here also covers a suspension racing a request
    const r = await db.query<SessionUser>(
      `select u.id, u.username, u.role from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now() and u.suspended_at is null`,
      [tokenHash(token)],
    );
    req.user = r.rows[0] ?? null;
  });

  app.post("/api/auth/register", async (req, reply) => {
    const { username, password } = readCredentials(req.body);
    if (username.length < USERNAME_RULES.min || username.length > USERNAME_RULES.max || !USERNAME_RULES.pattern.test(username)) {
      throw badRequest(`Usernames are ${USERNAME_RULES.min} to ${USERNAME_RULES.max} letters, numbers, - or _.`);
    }
    if (password.length < PASSWORD_RULES.min || password.length > PASSWORD_RULES.max) throw badRequest(`Passwords are at least ${PASSWORD_RULES.min} characters.`);
    const hash = await hashPassword(password);
    let id: string;
    const role: Role = config.adminUsernames.includes(username.toLowerCase()) ? "admin" : "player";
    try {
      id = (await db.query<{ id: string }>(
        "insert into users (username, password_hash, role, last_login_at) values ($1, $2, $3, now()) returning id", [username, hash, role])).rows[0].id;
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("That username is taken.", "username_taken");
      throw e;
    }
    const s = await createSession(db, id);
    setSessionCookie(reply, s.token, s.expires);
    reply.code(201);
    return { user: { id, username, role } };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { username, password } = readCredentials(req.body);
    const key = `${req.ip}|${username.toLowerCase()}`;
    checkThrottle(key);
    const row = (await db.query<SessionUser & { password_hash: string; suspended_at: Date | null; suspend_reason: string | null }>(
      "select id, username, role, password_hash, suspended_at, suspend_reason from users where lower(username) = lower($1)", [username])).rows[0];
    // verify against a dummy hash when the user doesn't exist, so timing doesn't reveal which usernames exist
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) { recordFailure(key); throw unauthorized("That username and password don't match."); }
    attempts.delete(key);
    // checked only after the password matched, so suspensions don't reveal which usernames exist
    if (row.suspended_at) throw forbidden(`This account is suspended${row.suspend_reason ? `: ${row.suspend_reason}` : "."}`, "suspended");
    await db.query("update users set last_login_at = now() where id = $1", [row.id]);
    const s = await createSession(db, row.id);
    setSessionCookie(reply, s.token, s.expires);
    return { user: { id: row.id, username: row.username, role: row.role } };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.query("delete from sessions where token_hash = $1", [tokenHash(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    if (!req.user) return { user: null };
    const r = await db.query<{ count: string; max_brutes: number }>(
      `select (select count(*) from brutes where owner_id = $1) as count,
              coalesce((select max_brutes from users where id = $1), (select (value)::int from settings where key = 'max_brutes_default')) as max_brutes`,
      [req.user.id]);
    return { user: { ...req.user, bruteCount: Number(r.rows[0].count), maxBrutes: r.rows[0].max_brutes } };
  });

  // expired sessions are cleaned up opportunistically
  void withTx(db, (tx) => tx.query("delete from sessions where expires_at < now()")).catch(() => {});
}

const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

/** Throws 401 when nobody is signed in; returns the user otherwise. */
export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

// Not encapsulated: the session hook and the request decoration must apply to every route in the app
// (the same thing fastify-plugin does).
(authPlugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
