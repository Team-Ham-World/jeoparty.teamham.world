import { randomUUID } from "node:crypto";
import { setTimeout as watchdog, clearTimeout as clearWatchdog } from "node:timers";
import { WebSocket } from "ws";
import type { HostView, PlayerView, SettingsPatch } from "@/features/engine/contract";
import type {
  AnyView,
  ClientCommand,
  ConnectionRole,
  ServerMessage,
} from "@/features/network/protocol";
import { Browser, type Harness } from "./test-harness";

/** Records the bytes delivered to a real socket, including acknowledgments and closing frames. */
export class Wire {
  readonly raw: string[] = [];
  readonly messages: ServerMessage[] = [];
  private readonly changed = new Set<() => void>();
  closeCode: number | null = null;
  constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      this.raw.push(data.toString());
      this.messages.push(JSON.parse(data.toString()));
      this.changed.forEach((fn) => fn());
    });
    ws.on("close", (code) => {
      this.closeCode = code;
      this.changed.forEach((fn) => fn());
    });
  }
  until<T>(read: () => T | undefined): Promise<T> {
    const value = read();
    if (value !== undefined) return Promise.resolve(value);
    return new Promise((resolve, reject) => {
      const timeout = watchdog(() => {
        this.changed.delete(check);
        reject(new Error(`Socket wait timed out; last frame: ${this.raw.at(-1)}`));
      }, 3000);
      const check = () => {
        const value = read();
        if (value === undefined) return;
        clearWatchdog(timeout);
        this.changed.delete(check);
        resolve(value);
      };
      this.changed.add(check);
    });
  }
  get view(): AnyView {
    const message = this.messages.findLast((m) => m.t === "view");
    if (!message || message.t !== "view") throw new Error("No view received");
    return message.view;
  }
  get host(): HostView {
    const view = this.view;
    if (view.audience !== "host") throw new Error("Expected host view");
    return view;
  }
  get player(): PlayerView {
    const view = this.view;
    if (view.audience !== "player") throw new Error("Expected player view");
    return view;
  }
  waitView(predicate: (view: AnyView) => boolean) {
    return this.until(() => {
      const message = this.messages.findLast((m) => m.t === "view");
      return message?.t === "view" && predicate(message.view) ? message.view : undefined;
    });
  }
  async send(cmd: ClientCommand, id: string = randomUUID()) {
    const from = this.messages.length;
    this.ws.send(JSON.stringify({ t: "cmd", id, cmd }));
    const ack = await this.until(() =>
      this.messages
        .slice(from)
        .find((m): m is Extract<ServerMessage, { t: "ack" }> => m.t === "ack" && m.id === id),
    );
    if (ack.ok) await this.waitView((v) => v.revision >= ack.revision);
    return ack;
  }
  async ok(cmd: ClientCommand, id?: string) {
    const ack = await this.send(cmd, id);
    if (!ack.ok) throw new Error(`${cmd.type}: ${ack.error}: ${ack.message}`);
    return ack;
  }
  async close() {
    this.ws.close();
    await this.until(() => this.closeCode ?? undefined);
  }
}

export async function connect(
  h: Pick<Harness, "base" | "app">,
  code: string,
  role: ConnectionRole,
  browser: Browser,
) {
  const ws = new WebSocket(`${h.base.replace("http:", "ws:")}/ws?room=${code}&role=${role}`, {
    headers: { cookie: browser.cookie, origin: h.app.config.publicOrigin },
  });
  const wire = new Wire(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  await wire.waitView(() => true);
  return wire;
}

export async function display(h: Harness, host: Browser, code: string) {
  const response = await host.mutate(`/api/rooms/${code}/display-link`);
  if (response.status !== 200) throw new Error("Display link failed");
  const { url } = await response.json();
  const key = new URLSearchParams(new URL(url).hash.slice(1)).get("key");
  const browser = new Browser(h);
  const claim = await browser.mutate("/api/display/claim", { code, key });
  if (claim.status !== 204) throw new Error("Display claim failed");
  return { browser, key, wire: await connect(h, code, "display", browser) };
}

export async function table(h: Harness, count = 3) {
  const host = new Browser(h);
  await host.signIn("host");
  const code = await host.createRoom();
  const a = await connect(h, code, "host", host);
  const browsers: Browser[] = [],
    players: Wire[] = [];
  for (let i = 0; i < count; i++) {
    const b = new Browser(h);
    await b.signIn(`player${i}`);
    const joined = await b.mutate(`/api/rooms/${code}/join`);
    if (joined.status !== 200) throw new Error("Join failed");
    browsers.push(b);
    players.push(await connect(h, code, "player", b));
  }
  const d = await display(h, host, code);
  return { host, code, a, browsers, players, d };
}

export async function start(a: Wire, packId: string, patch: SettingsPatch = {}) {
  await a.ok({ type: "choosePack", packId });
  await a.ok({
    type: "updateSettings",
    patch: { wagerClues: [0, 0], timers: { enabled: false }, ...patch },
  });
  await a.ok({ type: "startGame" });
  await a.ok({ type: "continue" });
}

export async function finishClue(a: Wire) {
  const clueId = a.host.clue!.clueId;
  await a.ok({ type: "reveal", clueId });
  await a.ok({ type: "returnToBoard", clueId });
}
