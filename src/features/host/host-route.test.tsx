// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostView } from "@/features/engine/contract";
import { ApiError } from "@/features/network/client/api";
import { PACKS, hostFixture } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { HostRoute } from "./host-route";

const LINK = "https://quiz.example/display/BCDFG#key=k1";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  connection: null as unknown,
  listPacks: vi.fn(),
  createDisplayLink: vi.fn(),
  leaveRoom: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/ui/session", () => ({
  useSession: () => ({
    status: "ready",
    session: { signedIn: true, csrfToken: "csrf-token", authMode: "fixture" },
    reload: () => {},
  }),
}));
vi.mock("@/features/network/client/use-room-connection", () => ({
  useRoomConnection: () => mocks.connection,
}));
vi.mock("@/features/network/client/api", async (actual) => ({
  ...(await actual<typeof import("@/features/network/client/api")>()),
  getRoom: async () => ({ myRole: "host", hostName: "Host" }),
  listPacks: mocks.listPacks,
  createDisplayLink: mocks.createDisplayLink,
  leaveRoom: mocks.leaveRoom,
}));

function show(view: HostView) {
  mocks.connection = mockConnection(view);
}

async function openRoute(view: HostView) {
  show(view);
  const result = render(<HostRoute code="BCDFG" />);
  await screen.findByRole("banner");
  await act(async () => {});
  return result;
}

const click = (name: string | RegExp, root: Pick<typeof screen, "getByRole"> = screen) =>
  act(async () => {
    fireEvent.click(root.getByRole("button", { name }));
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPacks.mockResolvedValue(PACKS);
  mocks.createDisplayLink.mockResolvedValue({ url: LINK });
  mocks.leaveRoom.mockResolvedValue(undefined);
});

describe("closing the room", () => {
  it.each(["lobby", "results"] as const)(
    "closes from %s after a warning, then goes home",
    async (id) => {
      await openRoute(hostFixture(id));
      await click("Close room");
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText(/Everyone in the room is disconnected/)).toBeVisible();
      expect(mocks.leaveRoom).not.toHaveBeenCalled();

      await click("Close room", dialog);

      expect(mocks.leaveRoom).toHaveBeenCalledWith("csrf-token", "BCDFG");
      expect(mocks.push).toHaveBeenCalledWith("/");
    },
  );

  it("isn't offered during a game", async () => {
    await openRoute(hostFixture("board"));
    expect(screen.queryByRole("button", { name: "Close room" })).toBeNull();
  });

  it("tells the host when it fails and stays put", async () => {
    mocks.leaveRoom.mockRejectedValue(new ApiError(500, "internal", "The server hiccuped."));
    await openRoute(hostFixture("lobby"));
    await click("Close room");
    await click("Close room", within(screen.getByRole("dialog")));

    expect(screen.getByText("Couldn't close the room. The server hiccuped.")).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close room" })).toBeEnabled();
  });
});

describe("the TV link", () => {
  it("keeps a link made in the lobby once the game starts", async () => {
    const { rerender } = await openRoute(hostFixture("lobby"));
    await click("Get display link");
    expect(screen.getByRole("textbox", { name: "Display link" })).toHaveValue(LINK);

    show(hostFixture("board"));
    rerender(<HostRoute code="BCDFG" />);
    await click("TV link");

    expect(screen.getByRole("textbox", { name: "Display link" })).toHaveValue(LINK);
    expect(mocks.createDisplayLink).toHaveBeenCalledTimes(1);
  });

  it("keeps the link when the in-game dialog closes and reopens", async () => {
    await openRoute(hostFixture("board"));
    await click("TV link");
    await click("Get display link");
    await click("Yes, make a new link");
    await click("Done");
    await click("TV link");

    expect(screen.getByRole("textbox", { name: "Display link" })).toHaveValue(LINK);
    expect(mocks.createDisplayLink).toHaveBeenCalledTimes(1);
  });

  it("never writes the link to browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await openRoute(hostFixture("lobby"));
    await click("Get display link");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe("the pack list", () => {
  it("refreshes when the tab regains focus", async () => {
    await openRoute(hostFixture("lobby"));
    expect(mocks.listPacks).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("option", { name: /Renamed Pack/ })).toBeNull();

    mocks.listPacks.mockResolvedValue([
      ...PACKS,
      { ...PACKS[2], id: "new", title: "Renamed Pack" },
    ]);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mocks.listPacks).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("option", { name: /Renamed Pack/ })).toBeInTheDocument();
  });
});
