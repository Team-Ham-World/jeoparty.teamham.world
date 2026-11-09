"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandOutcome, ConnectionStatus, UseRoomConnection } from "../connection";
import {
  PROTOCOL_VERSION,
  type AnyView,
  type ClientCommand,
  type CloseReason,
  type ServerMessage,
  type ViewFor,
} from "../protocol";
import { ApiError, getRoom } from "./api";

const COMMAND_TIMEOUT_MS = 15_000;
/** How often the client pings while connected. */
const HEARTBEAT_MS = 5_000;
/**
 * A ping with no answer for this long means the socket is dead even though
 * the browser hasn't noticed (a phone that lost Wi-Fi can keep a socket
 * "open" for minutes). Only an unanswered ping counts, so background tabs
 * with throttled timers never drop a healthy socket.
 */
const PONG_TIMEOUT_MS = 8_000;
/** A handshake that hasn't opened by now is abandoned and retried. */
const CONNECT_TIMEOUT_MS = 10_000;
/** Consecutive sockets closed without a hello before a host or player asks the server why. */
const REFUSED_BEFORE_ASKING = 3;
/** A TV has no session to ask with, so after this many it shows the fallback notice instead. */
const DISPLAY_REFUSED_WITHOUT_VIEW = 4;
const DISPLAY_REFUSED_WITH_VIEW = 8;
/** After a hide this long, an open socket's last view can't be trusted until it is re-sent. */
const STALE_AFTER_HIDDEN_MS = 3_000;
interface Pending {
  message: { t: "cmd"; id: string; cmd: ClientCommand };
  resolve(outcome: CommandOutcome): void;
  timer: ReturnType<typeof setTimeout>;
}

export const useRoomConnection: UseRoomConnection = function useRoomConnection<
  R extends "host" | "player" | "display",
>({ code, role }: { code: string; role: R }) {
  const [state, setState] = useState<{
    status: ConnectionStatus;
    view: AnyView | null;
    closeReason: CloseReason | null;
    clockOffsetMs: number;
    rttMs: number | null;
    pings: Record<string, number | null>;
    identity: string;
  }>({
    identity: `${role}:${code}`,
    status: "connecting",
    view: null,
    closeReason: null,
    clockOffsetMs: 0,
    rttMs: null,
    pings: {},
  });
  const sendRef = useRef<(command: ClientCommand) => Promise<CommandOutcome>>(() =>
    Promise.resolve({
      ok: false,
      error: "offline",
      message: "Connection is offline.",
    }),
  );
  useEffect(() => {
    let disposed = false,
      intentional = false,
      live = false,
      retries = 0,
      hello = false, // Has the current socket said hello?
      helloCount = 0,
      refusedSockets = 0, // Consecutive sockets that closed without a hello.
      askingServer = false,
      connectStartedAt = 0;
    let hiddenAt: number | null = document.visibilityState === "visible" ? null : Date.now();
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    /** When the oldest unanswered ping went out; null once anything arrives. */
    let unansweredPingAt: number | null = null;
    let latestRevision = -1;
    const pending = new Map<string, Pending>();
    const settle = (outcome: CommandOutcome) => {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.resolve(outcome);
      }
      pending.clear();
    };
    // The effect owns one room identity. Responses from an old socket cannot update a new room.
    queueMicrotask(() => {
      if (!disposed)
        setState({
          identity: `${role}:${code}`,
          status: "connecting",
          view: null,
          closeReason: null,
          clockOffsetMs: 0,
          rttMs: null,
          pings: {},
        });
    });
    /** The socket is gone (closed, dead or offline): go stale and retry with backoff. */
    function lost() {
      live = false;
      unansweredPingAt = null;
      clearInterval(heartbeat);
      clearTimeout(connectTimer);
      if (disposed || intentional) return;
      if (!hello) refusedSockets++;
      // The notice is only a sign for the people in the room: the TV keeps retrying behind it.
      const displayGivesUp =
        role === "display" &&
        refusedSockets >=
          (latestRevision >= 0 ? DISPLAY_REFUSED_WITH_VIEW : DISPLAY_REFUSED_WITHOUT_VIEW);
      setState((previous) => ({
        ...previous,
        status:
          displayGivesUp || (role === "display" && previous.status === "closed")
            ? "closed"
            : "reconnecting",
      }));
      clearTimeout(reconnect);
      const delay =
        Math.min(10_000, 500 * 2 ** Math.min(retries++, 5)) * (0.75 + Math.random() * 0.5);
      reconnect = setTimeout(connect, delay);
      if (role !== "display" && refusedSockets >= REFUSED_BEFORE_ASKING) void askWhyRefused();
    }
    /** Stop for good: no more retries, pending commands fail, and the screen shows `reason`. */
    function stopForGood(reason: CloseReason | null) {
      intentional = true;
      live = false;
      clearTimeout(reconnect);
      clearTimeout(connectTimer);
      clearInterval(heartbeat);
      setState((previous) => ({ ...previous, status: "closed", closeReason: reason }));
      settle({ ok: false, error: "offline", message: "Connection closed." });
      socket?.close();
    }
    /** The reason the server is refusing this role, or null if it gave no clear answer. */
    async function refusalReason(): Promise<CloseReason | null> {
      try {
        const { myRole } = await getRoom(code);
        const fits = role === "host" ? myRole === "host" : myRole !== null;
        return fits ? null : "removed";
      } catch (error) {
        if (!(error instanceof ApiError)) return null;
        if (error.status === 404 && error.code === "notFound") return "roomClosed";
        return error.status === 401 ? "authExpired" : null;
      }
    }
    /** The browser hides why an upgrade failed, so ask over HTTP. Only a clear answer stops us. */
    async function askWhyRefused() {
      if (askingServer) return;
      askingServer = true;
      const hellosBefore = helloCount;
      const reason = await refusalReason();
      askingServer = false;
      if (reason && !disposed && !intentional && helloCount === hellosBefore) stopForGood(reason);
    }
    /** Abandon the current socket without waiting for the browser to notice it died. */
    function drop(ws: WebSocket) {
      if (disposed || socket !== ws) return;
      socket = undefined; // Late events from `ws` are ignored from here on.
      try {
        ws.close();
      } catch {
        // Already closing.
      }
      lost();
    }
    function onOffline() {
      if (socket) drop(socket);
    }
    function reconnectNow() {
      clearTimeout(reconnect);
      retries = 0;
      connect();
    }
    function onOnline() {
      // Back online: retry now instead of waiting out the backoff.
      if (disposed || intentional || socket) return;
      reconnectNow();
    }
    function onVisible() {
      if (document.visibilityState !== "visible") {
        hiddenAt ??= Date.now();
        return;
      }
      const hiddenMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (disposed || intentional) return;
      // Phones freeze timers while asleep; check the socket as soon as the page is back.
      if (!socket) {
        reconnectNow();
      } else if (unansweredPingAt !== null && Date.now() - unansweredPingAt > PONG_TIMEOUT_MS) {
        drop(socket);
      } else if (socket.readyState === WebSocket.OPEN) {
        if (live && hiddenMs > STALE_AFTER_HIDDEN_MS) {
          // The buzzer on screen may be long out of date: hold it until the server re-sends the view.
          live = false;
          setState((previous) => ({ ...previous, status: "reconnecting" }));
          socket.send(JSON.stringify({ t: "resync" }));
        }
        unansweredPingAt ??= Date.now();
        socket.send(JSON.stringify({ t: "ping", at: Date.now() }));
      } else if (
        socket.readyState === WebSocket.CONNECTING &&
        Date.now() - connectStartedAt > CONNECT_TIMEOUT_MS
      ) {
        // The handshake's own timeout was frozen along with the page.
        drop(socket);
        reconnectNow();
      }
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    function connect() {
      if (disposed || intentional) return;
      const url = new URL("/ws", window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("room", code);
      url.searchParams.set("role", role);
      const ws = new WebSocket(url);
      socket = ws;
      hello = false;
      connectStartedAt = Date.now();
      setState((previous) => ({ ...previous, rttMs: null, pings: {} }));
      const clockSamples: { rttMs: number; offsetMs: number }[] = [];
      const active = () => !disposed && socket === ws;
      connectTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) drop(ws);
      }, CONNECT_TIMEOUT_MS);
      ws.onmessage = (event) => {
        if (!active()) return;
        unansweredPingAt = null;
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          ws.close();
          return;
        }
        if (message.t === "probe") {
          ws.send(JSON.stringify({ t: "probeAck", id: message.id }));
          return;
        }
        if (message.t === "pings" && role === "host") {
          setState((previous) => ({ ...previous, pings: message.pings }));
          return;
        }
        if (message.t === "closing") {
          // A restart is not the end for a TV: it stays up and comes back with the server.
          if (role === "display" && message.reason === "serverShutdown") drop(ws);
          else stopForGood(message.reason);
          return;
        }
        if (intentional) return;
        if (message.t === "hello") {
          if (message.protocol !== PROTOCOL_VERSION || message.role !== role) {
            stopForGood(null);
            return;
          }
          hello = true;
          helloCount++;
          refusedSockets = 0;
          setState((previous) => ({
            ...previous,
            clockOffsetMs: message.serverNow - Date.now(),
          }));
        } else if (message.t === "view" && hello && message.view.audience === role) {
          if (
            !Number.isSafeInteger(message.view.revision) ||
            message.view.revision < latestRevision
          )
            return;
          latestRevision = message.view.revision;
          const first = !live;
          live = true;
          retries = 0;
          setState((previous) => ({
            ...previous,
            status: "live",
            view: message.view,
          }));
          if (first) for (const entry of pending.values()) ws.send(JSON.stringify(entry.message));
        } else if (message.t === "ack") {
          const entry = pending.get(message.id);
          if (entry) {
            clearTimeout(entry.timer);
            pending.delete(message.id);
            entry.resolve(
              message.ok
                ? { ok: true, revision: message.revision }
                : { ok: false, error: message.error, message: message.message },
            );
          }
        } else if (message.t === "pong") {
          const received = Date.now();
          const rttMs = received - message.at;
          if (rttMs < 0 || !Number.isFinite(rttMs)) return;
          clockSamples.push({ rttMs, offsetMs: message.serverNow - (message.at + received) / 2 });
          if (clockSamples.length > 10) clockSamples.shift();
          const best = clockSamples.reduce((a, b) => (a.rttMs <= b.rttMs ? a : b));
          setState((previous) => ({
            ...previous,
            clockOffsetMs: best.offsetMs,
            rttMs: best.rttMs,
          }));
        }
      };
      ws.onopen = () => {
        if (!active()) return;
        clearTimeout(connectTimer);
        const ping = () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (unansweredPingAt !== null && Date.now() - unansweredPingAt > PONG_TIMEOUT_MS) {
            drop(ws);
            return;
          }
          unansweredPingAt ??= Date.now();
          ws.send(JSON.stringify({ t: "ping", at: Date.now() }));
        };
        ping();
        clearInterval(heartbeat);
        heartbeat = setInterval(ping, HEARTBEAT_MS);
      };
      ws.onerror = () => {
        ws.close();
      };
      ws.onclose = () => {
        if (!active()) return;
        socket = undefined;
        lost();
      };
    }
    sendRef.current = (cmd) => {
      if (
        !live ||
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        intentional ||
        role === "display"
      )
        return Promise.resolve({
          ok: false,
          error: "offline",
          message: "Connection is offline or read-only.",
        });
      const id = crypto.randomUUID();
      const message = { t: "cmd" as const, id, cmd };
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          resolve({
            ok: false,
            error: "timeout",
            message: "The command timed out. Its result may have been saved.",
          });
        }, COMMAND_TIMEOUT_MS);
        pending.set(id, { message, timer, resolve });
        socket?.send(JSON.stringify(message));
      });
    };
    connect();
    return () => {
      disposed = true;
      live = false;
      clearTimeout(reconnect);
      clearTimeout(connectTimer);
      clearInterval(heartbeat);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      socket?.close();
      settle({ ok: false, error: "offline", message: "Connection closed." });
      sendRef.current = () =>
        Promise.resolve({
          ok: false,
          error: "offline",
          message: "Connection is offline.",
        });
    };
  }, [code, role]);
  const current =
    state.identity === `${role}:${code}`
      ? state
      : {
          status: "connecting" as const,
          view: null,
          closeReason: null,
          clockOffsetMs: 0,
          rttMs: null,
          pings: {},
        };
  return {
    ...current,
    view: current.view as ViewFor<R> | null,
    stale: current.status !== "live",
    send: (cmd) =>
      state.identity === `${role}:${code}`
        ? sendRef.current(cmd)
        : Promise.resolve({
            ok: false,
            error: "offline",
            message: "Connection is changing rooms.",
          }),
  };
};
