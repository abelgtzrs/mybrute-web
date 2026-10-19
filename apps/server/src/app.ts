import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { adminRoutes } from "./admin";
import { authPlugin, requireUser } from "./auth";
import * as classic from "./classic";
import type { Db } from "./db";
import { HttpError } from "./errors";
import * as lab from "./lab";

export interface AppOptions { db: Db; webDist?: string | null; logger?: boolean }

export async function buildApp({ db, webDist = null, logger = false }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger, bodyLimit: 64 * 1024, trustProxy: true });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: "bad_request", message: "That request couldn't be read." });
    req.log.error(err);
    return reply.code(500).send({ error: "server_error", message: "Something went wrong on the server. Try again." });
  });

  await app.register(cookie);
  await app.register(authPlugin, { db });

  type P = { Params: { id: string } };
  app.get("/api/brutes", async (req) => classic.listBrutes(db, requireUser(req).id));
  app.post("/api/brutes", async (req, reply) => { reply.code(201); return classic.createBrute(db, requireUser(req).id, req.body); });
  app.get<P>("/api/brutes/:id", async (req) => classic.getCell(db, requireUser(req).id, req.params.id));
  app.delete<P>("/api/brutes/:id", async (req) => classic.deleteBrute(db, requireUser(req).id, req.params.id));
  app.post<P>("/api/brutes/:id/opponents", async (req) => classic.newOpponents(db, requireUser(req).id, req.params.id));
  app.post<P>("/api/brutes/:id/fights", async (req) => classic.startFight(db, requireUser(req).id, req.params.id, req.body));
  app.get<P & { Querystring: { page?: string; result?: string } }>("/api/brutes/:id/fights", async (req) =>
    classic.listFights(db, requireUser(req).id, req.params.id, { page: Number(req.query.page) || 1, result: req.query.result }));
  app.post<P>("/api/brutes/:id/level-up", async (req) => classic.levelUp(db, requireUser(req).id, req.params.id, req.body));
  app.get<P>("/api/fights/:id", async (req) => classic.getFight(db, requireUser(req).id, req.params.id));

  app.get("/api/lab/payloads", async (req) => lab.listPayloads(db, requireUser(req).id));
  app.post("/api/lab/payloads", async (req, reply) => { reply.code(201); return lab.savePayload(db, requireUser(req).id, req.body); });
  app.delete<P>("/api/lab/payloads/:id", async (req) => lab.deletePayload(db, requireUser(req).id, req.params.id));
  app.get("/api/lab/brutes", async (req) => lab.listLabBrutes(db, requireUser(req).id));
  app.post("/api/lab/brutes", async (req, reply) => { reply.code(201); return lab.saveLabBrute(db, requireUser(req).id, req.body); });
  app.delete<P>("/api/lab/brutes/:id", async (req) => lab.deleteLabBrute(db, requireUser(req).id, req.params.id));

  adminRoutes(app, db);

  app.all("/api/*", async (_req, reply) => reply.code(404).send({ error: "not_found", message: "Unknown API route." }));

  // production: serve the built web app, with client-side routes falling back to index.html
  if (webDist && existsSync(join(webDist, "index.html"))) {
    const index = readFileSync(join(webDist, "index.html"), "utf8");
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== "GET" || req.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found", message: "Not found." });
      return reply.type("text/html").send(index);
    });
  }
  return app;
}
