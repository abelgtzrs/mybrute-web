// @mybrute/engine: the original La Brute engine (vendored, unchanged apart from one documented export)
// plus thin adapters. Shared by the web app (Laboratory + Classic viewer) and the server (authoritative fights).
export { GladAPI, FightAPI, LaBrute, FightLog, Inventory, TEAM_STATS } from "./vendor";
export type { Description, LevelOption, HistoryEvent, EngineInput, EngineResult, EngineGlad } from "./vendor";
export * from "./progression";
export * from "./gfx";
export * from "./payload";
export * from "./stats";
export * from "./lab";
export { inventoryParams, INVENTORY_LANGS } from "./inventory";
