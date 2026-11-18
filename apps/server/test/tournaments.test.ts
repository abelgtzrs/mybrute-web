import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { harness, Player, reset, type Harness } from "./helpers";

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.app.close(); await h.db.end(); });
beforeEach(async () => { await reset(h.db); });

const tournament = {
  name: "Spring cup",
  format: "single",
  entrants: [{ id: "a" }, { id: "b" }],
  matches: [],
};

describe("tournament saves", () => {
  it("creates, lists, updates and deletes a player's saved tournament", async () => {
    const player = await Player.register(h.app, "tourney_player");
    const anonymous = new Player(h.app, "anonymous");
    expect((await anonymous.call("GET", "/api/tournaments")).status).toBe(401);
    expect((await player.call("GET", "/api/tournaments")).status).toBe(403);
    await h.db.query("update users set role = 'admin' where username = 'tourney_player'");

    const created = await player.call("POST", "/api/tournaments", { label: "Spring Cup", tournament });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({ label: "Spring Cup", tournament });
    const key = created.body.item.key as string;
    expect((await player.call("GET", "/api/tournaments")).body.items).toHaveLength(1);

    const updated = await player.call("POST", `/api/tournaments/${key}`, { label: "Summer Cup", tournament: { ...tournament, name: "Summer cup" } });
    expect(updated.status).toBe(200);
    expect(updated.body.item).toMatchObject({ label: "Summer Cup", tournament: { name: "Summer cup" } });

    const other = await Player.register(h.app, "other_player");
    await h.db.query("update users set role = 'admin' where username = 'other_player'");
    expect((await other.call("POST", `/api/tournaments/${key}`, { label: "Stolen", tournament })).status).toBe(404);
    expect((await other.call("DELETE", `/api/tournaments/${key}`)).status).toBe(200);
    expect((await player.call("GET", "/api/tournaments")).body.items).toHaveLength(1);
    expect((await player.call("DELETE", `/api/tournaments/${key}`)).status).toBe(200);
    expect((await player.call("GET", "/api/tournaments")).body.items).toHaveLength(0);
  });

  it("rejects malformed or oversized tournaments", async () => {
    const player = await Player.register(h.app, "tourney_invalid");
    await h.db.query("update users set role = 'admin' where username = 'tourney_invalid'");
    expect((await player.call("POST", "/api/tournaments", { label: "Bad", tournament: { ...tournament, format: "unknown" } })).status).toBe(400);
    expect((await player.call("POST", "/api/tournaments", { label: "Bad", tournament: { ...tournament, entrants: [] } })).status).toBe(400);
    expect((await player.call("POST", "/api/tournaments", { label: "Bad", tournament: { ...tournament, entrants: Array(65).fill({ id: "x" }) } })).status).toBe(400);
    expect((await player.call("POST", "/api/tournaments", { label: "Bad", tournament: { ...tournament, matches: Array(1001).fill({}) } })).status).toBe(400);
    expect((await player.call("POST", "/api/tournaments", { label: "Bad", tournament: { ...tournament, name: "x".repeat(450_001) } })).status).toBe(400);
  });
});
