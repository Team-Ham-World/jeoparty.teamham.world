// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createRoom,
  getSession,
  leaveRoom,
  listMyRooms,
  listPacks,
} from "@/features/network/client/api";
import type { RoomSummary } from "@/features/network/protocol";
import { PACKS, SESSION_SIGNED_IN, SESSION_SIGNED_OUT } from "@/features/preview/fixtures";
import { HomeRoute } from "./home-route";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/features/network/client/api", async (original) => ({
  ...(await original<typeof import("@/features/network/client/api")>()),
  getSession: vi.fn(),
  listPacks: vi.fn(),
  listMyRooms: vi.fn(),
  leaveRoom: vi.fn(),
  createRoom: vi.fn(),
}));

function room(code: string, status: RoomSummary["status"], playerCount: number): RoomSummary {
  return { code, status, playerCount, maxPlayers: 6, hostName: "Host", myRole: "host" };
}

async function openHome(view?: "create" | "join") {
  window.history.replaceState(null, "", view ? `/?view=${view}` : "/");
  await act(async () => {
    render(<HomeRoute />);
  });
}

const panel = () => screen.queryByRole("region", { name: "Your open rooms" });

async function confirmClose(code: string) {
  fireEvent.click(screen.getByRole("button", { name: `Close room ${code}` }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Close room" }));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockResolvedValue(SESSION_SIGNED_IN);
  vi.mocked(listPacks).mockResolvedValue(PACKS);
  vi.mocked(listMyRooms).mockResolvedValue([]);
  vi.mocked(leaveRoom).mockResolvedValue(undefined);
});

describe("your open rooms", () => {
  it("stays hidden with no open rooms", async () => {
    await openHome();
    expect(panel()).toBeNull();
  });

  it("isn't requested when signed out", async () => {
    vi.mocked(getSession).mockResolvedValue(SESSION_SIGNED_OUT);
    await openHome();
    expect(listMyRooms).not.toHaveBeenCalled();
  });

  it("lists each room's code, status and players with a link back", async () => {
    vi.mocked(listMyRooms).mockResolvedValue([
      room("BCDFG", "playing", 3),
      room("HJKLM", "lobby", 1),
    ]);
    await openHome();
    const rows = within(panel()!).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("BCDFG");
    expect(rows[0]).toHaveTextContent("Playing");
    expect(rows[0]).toHaveTextContent("3 players");
    expect(rows[1]).toHaveTextContent("In the lobby");
    expect(rows[1]).toHaveTextContent("1 player");
    expect(screen.getByRole("link", { name: "Open room BCDFG" })).toHaveAttribute(
      "href",
      "/host/BCDFG",
    );
  });

  it("closes a room only after confirming, then refreshes", async () => {
    vi.mocked(listMyRooms).mockResolvedValueOnce([room("BCDFG", "lobby", 2)]);
    await openHome();
    fireEvent.click(screen.getByRole("button", { name: "Close room BCDFG" }));
    expect(leaveRoom).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("disconnected");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close room" }));
    });
    expect(leaveRoom).toHaveBeenCalledWith(
      SESSION_SIGNED_IN.signedIn ? SESSION_SIGNED_IN.csrfToken : "",
      "BCDFG",
    );
    expect(listMyRooms).toHaveBeenCalledTimes(2);
    expect(panel()).toBeNull();
  });

  it("shows why a close failed and keeps the room listed", async () => {
    vi.mocked(listMyRooms).mockResolvedValue([room("BCDFG", "lobby", 2)]);
    vi.mocked(leaveRoom).mockRejectedValue(new ApiError(500, "internal", "Server trouble."));
    await openHome();
    await confirmClose("BCDFG");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't close room BCDFG. Server trouble.",
    );
    expect(within(panel()!).getByText("BCDFG")).toBeVisible();
  });

  it("shows a failed list load without breaking the page, and can retry", async () => {
    vi.mocked(listMyRooms).mockRejectedValueOnce(new ApiError(500, "internal", "Server trouble."));
    await openHome("create");
    expect(screen.getByRole("alert")).toHaveTextContent("Server trouble.");
    expect(screen.getByRole("button", { name: "Create game" })).toBeEnabled();

    vi.mocked(listMyRooms).mockResolvedValue([room("BCDFG", "lobby", 2)]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(panel()!).getByText("BCDFG")).toBeVisible();
  });

  it("brings the list up to date when Create game hits the room limit", async () => {
    const message = "A host can have at most 3 open rooms. Close a room first.";
    vi.mocked(createRoom).mockRejectedValue(new ApiError(409, "conflict", message));
    await openHome("create");
    expect(panel()).toBeNull();

    vi.mocked(listMyRooms).mockResolvedValue([
      room("BCDFG", "lobby", 0),
      room("HJKLM", "playing", 2),
      room("NPQRS", "finished", 4),
    ]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create game" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(within(panel()!).getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("create a lobby", () => {
  const create = () => screen.getByRole("button", { name: "Create game" });
  const adjust = () => screen.getByRole("button", { name: "Adjust settings" });
  const csrf = SESSION_SIGNED_IN.signedIn ? SESSION_SIGNED_IN.csrfToken : "";

  it("updates the format and creates with the selected pack and collapsed settings draft", async () => {
    vi.mocked(createRoom).mockResolvedValue({ code: "BCDFG" });
    await openHome("create");
    expect(screen.getByRole("button", { name: /HAM Party Pack/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("2 rounds · 6 categories per round · Final on")).toBeVisible();
    fireEvent.click(adjust());
    fireEvent.click(screen.getByRole("button", { name: /Team Ham Small Trivia Pack/ }));
    expect(screen.getByText("1 round · 3 categories per round · Final on")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "2 rounds" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Final round" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Answer time (s)" }), {
      target: { value: "22" },
    });
    expect(screen.getByText("2 rounds · 1 category per round · Final off")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    await act(async () => {
      fireEvent.click(create());
    });
    expect(createRoom).toHaveBeenCalledExactlyOnceWith(csrf, {
      packId: PACKS[1].id,
      settings: expect.objectContaining({
        rounds: 2,
        categoriesPerRound: 1,
        finalRound: false,
        timers: expect.objectContaining({ answerWindowMs: 22_000 }),
      }),
    });
    expect(push).toHaveBeenCalledWith("/host/BCDFG");
  });

  it("opens the settings and focuses an invalid draft without creating a room", async () => {
    await openHome("create");
    fireEvent.click(adjust());
    const timer = screen.getByRole("textbox", { name: "Answer time (s)" });
    fireEvent.change(timer, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    fireEvent.click(create());

    expect(createRoom).not.toHaveBeenCalled();
    expect(timer).toBeVisible();
    expect(timer).toHaveFocus();
    expect(timer).toHaveAccessibleDescription("Use 3–60 seconds.");
  });

  it("can create with the server's default pack when the pack list fails", async () => {
    vi.mocked(listPacks).mockRejectedValue(new ApiError(500, "internal", "Packs unavailable."));
    vi.mocked(createRoom).mockResolvedValue({ code: "BCDFG" });
    await openHome("create");
    expect(screen.getByRole("alert")).toHaveTextContent("Packs unavailable.");
    expect(screen.getByText("The game will use the default pack.")).toBeVisible();
    await act(async () => {
      fireEvent.click(create());
    });
    expect(createRoom).toHaveBeenCalledExactlyOnceWith(csrf, {});
    expect(push).toHaveBeenCalledWith("/host/BCDFG");
  });
});
