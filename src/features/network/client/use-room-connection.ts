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
    identity: string;
  }>({
    identity: `${role}:${code}`,
    status: "connecting",
    view: null,
    closeReason: null,
    clockOffsetMs: 0,
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
      retries = 0;
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
        });
    });
    /** The socket is gone (closed, dead or offline): go stale and retry with backoff. */
    function lost() {
      live = false;
      unansweredPingAt = null;
      clearInterval(heartbeat);
      clearTimeout(connectTimer);
      if (disposed || intentional) return;
      setState((previous) => ({ ...previous, status: "reconnecting" }));
      clearTimeout(reconnect);
      const delay =
        Math.min(10_000, 500 * 2 ** Math.min(retries++, 5)) * (0.75 + Math.random() * 0.5);
      reconnect = setTimeout(connect, delay);
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
    function onOnline() {
      // Back online: retry now instead of waiting out the backoff.
      if (disposed || intentional || socket) return;
      clearTimeout(reconnect);
      retries = 0;
      connect();
    }
    function onVisible() {
      // Phones freeze timers while asleep; check the socket as soon as the page is back.
      if (document.visibilityState !== "visible" || !socket) return;
      if (unansweredPingAt !== null && Date.now() - unansweredPingAt > PONG_TIMEOUT_MS) {
        drop(socket);
      } else if (socket.readyState === WebSocket.OPEN) {
        unansweredPingAt ??= Date.now();
        socket.send(JSON.stringify({ t: "ping", at: Date.now() }));
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
      let hello = false;
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
        if (message.t === "closing") {
          intentional = true;
          live = false;
          clearTimeout(reconnect);
          clearTimeout(connectTimer);
          clearInterval(heartbeat);
          setState((previous) => ({
            ...previous,
            status: "closed",
            closeReason: message.reason,
          }));
          settle({
            ok: false,
            error: "offline",
            message: "Connection closed.",
          });
          ws.close();
          return;
        }
        if (intentional) return;
        if (message.t === "hello") {
          if (message.protocol !== PROTOCOL_VERSION || message.role !== role) {
            ws.close();
            return;
          }
          hello = true;
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
          setState((previous) => ({
            ...previous,
            clockOffsetMs: message.serverNow - (message.at + received) / 2,
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
