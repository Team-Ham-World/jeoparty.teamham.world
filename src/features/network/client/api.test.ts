import { afterEach, describe, expect, it, vi } from "vitest";
import { CSRF_HEADER } from "../protocol";
import {
  ApiError,
  createDisplayLink,
  createRoom,
  deletePack,
  getSession,
  joinRoom,
  listMyRooms,
  logout,
  updatePack,
  uploadPicture,
} from "./api";

type Call = [string, RequestInit];

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls as unknown as Call[];
}

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

afterEach(() => vi.unstubAllGlobals());

describe("api helpers", () => {
  it("sends the CSRF header on every mutating request", async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ code: "BCDFG" }), { status: 200 }));
    await createRoom("csrf-1", { packId: "pack-ham" });
    await joinRoom("csrf-2", "BCDFG");
    await createDisplayLink("csrf-3", "BCDFG");
    await updatePack("csrf-4", "p1", { title: "x" });
    const [create, join, display, update] = calls();
    expect(create[0]).toBe("/api/rooms");
    expect(create[1].method).toBe("POST");
    expect(headersOf(create[1])[CSRF_HEADER]).toBe("csrf-1");
    expect(JSON.parse(String(create[1].body))).toEqual({ packId: "pack-ham" });
    expect(headersOf(join[1])[CSRF_HEADER]).toBe("csrf-2");
    expect(display[0]).toBe("/api/rooms/BCDFG/display-link");
    expect(headersOf(display[1])[CSRF_HEADER]).toBe("csrf-3");
    expect(update[1].method).toBe("PUT");
    expect(JSON.parse(String(update[1].body))).toEqual({ pack: { title: "x" } });
  });

  it("sends the loaded version with a pack update and surfaces the conflict", async () => {
    const calls = stubFetch(
      () =>
        new Response(JSON.stringify({ error: "conflict", message: "Changed in another tab." }), {
          status: 409,
        }),
    );
    await expect(
      updatePack("t", "p1", { title: "x" }, "2026-11-09T10:00:00Z"),
    ).rejects.toMatchObject({ status: 409, code: "conflict", message: "Changed in another tab." });
    expect(JSON.parse(String(calls()[0][1].body))).toEqual({
      pack: { title: "x" },
      expectedUpdatedAt: "2026-11-09T10:00:00Z",
    });
  });

  it("lists the rooms this host has open", async () => {
    const rooms = [{ code: "BCDFG", status: "lobby", playerCount: 2 }];
    const calls = stubFetch(() => new Response(JSON.stringify(rooms), { status: 200 }));
    await expect(listMyRooms()).resolves.toEqual(rooms);
    expect(calls()[0][0]).toBe("/api/rooms");
    expect(calls()[0][1].method).toBe("GET");
  });

  it("handles 204 responses for logout and delete", async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }));
    await expect(logout("t")).resolves.toBeUndefined();
    await expect(deletePack("t", "p/1")).resolves.toBeUndefined();
    expect(calls()[1][0]).toBe("/api/packs/p%2F1");
    expect(headersOf(calls()[1][1])[CSRF_HEADER]).toBe("t");
  });

  it("does not send a CSRF header on GET", async () => {
    const calls = stubFetch(
      () => new Response(JSON.stringify({ signedIn: false, authMode: "fixture" }), { status: 200 }),
    );
    await expect(getSession()).resolves.toEqual({ signedIn: false, authMode: "fixture" });
    expect(headersOf(calls()[0][1])[CSRF_HEADER]).toBeUndefined();
  });

  it("throws a typed ApiError with validation errors", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            error: "invalidPack",
            message: "Fix the pack.",
            validationErrors: [{ path: "title", message: "Expected a non-empty string." }],
          }),
          {
            status: 400,
          },
        ),
    );
    const error = await updatePack("t", "p1", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "invalidPack", message: "Fix the pack." });
    expect((error as ApiError).validationErrors).toEqual([
      { path: "title", message: "Expected a non-empty string." },
    ]);
  });

  it("turns network failures into a readable ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await expect(getSession()).rejects.toMatchObject({ code: "network", status: 0 });
  });
});

it("uploads the Blob itself with its content type and CSRF token", async () => {
  const id = `pic_${"a".repeat(43)}`;
  const calls = stubFetch(() => new Response(JSON.stringify({ id }), { status: 201 }));
  const jpeg = new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
  await expect(uploadPicture("csrf-picture", jpeg)).resolves.toEqual({ id });
  const [path, init] = calls()[0];
  expect(path).toBe("/api/pictures");
  expect(init.method).toBe("POST");
  expect(init.body).toBe(jpeg);
  expect(headersOf(init)["content-type"]).toBe("image/jpeg");
  expect(headersOf(init)[CSRF_HEADER]).toBe("csrf-picture");
});
