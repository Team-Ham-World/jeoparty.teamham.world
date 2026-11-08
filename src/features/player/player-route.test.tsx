// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomSummary, SessionInfo } from "@/features/network/protocol";
import { PlayerRoute } from "./player-route";

const SESSION: SessionInfo = {
  signedIn: true,
  authMode: "fixture",
  user: { id: "u-late", name: "latecomer" },
  csrfToken: "csrf-test",
};

function summary(over: Partial<RoomSummary> = {}): RoomSummary {
  return {
    code: "BCDFG",
    status: "lobby",
    hostName: "the.quiz.host",
    playerCount: 6,
    maxPlayers: 6,
    myRole: null,
    ...over,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Fakes the three endpoints the join gate uses. `rooms` answers GET /api/rooms/BCDFG in order. */
function stubServer(rooms: RoomSummary[]) {
  const calls: string[] = [];
  let next = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/api/session") return json(SESSION);
      if (url === "/api/rooms/BCDFG") return json(rooms[Math.min(next++, rooms.length - 1)]);
      if (url === "/api/rooms/BCDFG/join")
        return json({ error: "roomFull", message: "All six seats are taken." }, 409);
      return json({ error: "notFound", message: "Not found." }, 404);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("player join gate", () => {
  it("a full room swaps Join for Check again, and Join returns once a seat frees up", async () => {
    const calls = stubServer([
      summary({ playerCount: 5 }), // first look: a seat seems free
      summary(), // after the "full" answer: 6 of 6
      summary(), // Check again: still full
      summary({ playerCount: 5 }), // Check again: someone left
    ]);
    render(<PlayerRoute code="BCDFG" />);

    fireEvent.click(await screen.findByRole("button", { name: "Join game" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("banner", "banner--bad");
    expect(alert).toHaveTextContent("This game is full");
    expect(screen.queryByRole("button", { name: "Join game" })).toBeNull();
    const check = screen.getByRole("button", { name: "Check again" });
    expect(check).not.toHaveClass("btn--primary");
    await waitFor(() => expect(screen.getByText("6 of 6")).toBeInTheDocument());

    fireEvent.click(check);
    await waitFor(() => expect(calls.filter((c) => c === "GET /api/rooms/BCDFG")).toHaveLength(3));
    expect(await screen.findByRole("button", { name: "Check again" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("This game is full");

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("button", { name: "Join game" })).toHaveClass("btn--primary");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("5 of 6")).toBeInTheDocument();
  });

  it("offers 'Join the next game' after a check finds the game has started", async () => {
    stubServer([summary(), summary(), summary({ status: "playing" })]);
    render(<PlayerRoute code="BCDFG" />);
    fireEvent.click(await screen.findByRole("button", { name: "Join game" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("button", { name: "Join the next game" })).toBeInTheDocument();
  });

  it("tells the host to open the control room, under the usual top bar", async () => {
    stubServer([summary({ myRole: "host", playerCount: 2 })]);
    render(<PlayerRoute code="BCDFG" />);
    expect(
      await screen.findByRole("heading", { name: "You're hosting room BCDFG" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the control room" })).toHaveAttribute(
      "href",
      "/host/BCDFG",
    );
    expect(screen.getByRole("link", { name: /^HAM ?Quiz$/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("banner")).toHaveClass("topbar");
  });
});
