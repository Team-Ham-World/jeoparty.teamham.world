import type { EngineApi } from "./contract";

const notImplemented = (name: string) => (): never => {
  throw new Error(`engine.${name} is not implemented yet`);
};

/** Placeholder until the engine lands. The engine task replaces this file. */
export const engine: EngineApi = {
  createGame: notImplemented("createGame"),
  defaultSettings: notImplemented("defaultSettings"),
  apply: notImplemented("apply"),
  nextDeadline: notImplemented("nextDeadline"),
  hostView: notImplemented("hostView"),
  playerView: notImplemented("playerView"),
  displayView: notImplemented("displayView"),
  restore: notImplemented("restore"),
};
