import { afterEach, describe, expect, it, vi } from "vitest";
import { CSRF_HEADER } from "../protocol";
import { ApiError, createDisplayLink, createRoom, deletePack, getSession, joinRoom, logout, updatePack } from "./api";

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

  it("handles 204 responses for logout and delete", async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }));
    await expect(logout("t")).resolves.toBeUndefined();
    await expect(deletePack("t", "p/1")).resolves.toBeUndefined();
    expect(calls()[1][0]).toBe("/api/packs/p%2F1");
    expect(headersOf(calls()[1][1])[CSRF_HEADER]).toBe("t");
  });

  it("does not send a CSRF header on GET", async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ signedIn: false, authMode: "fixture" }), { status: 200 }));
    await expect(getSession()).resolves.toEqual({ signedIn: false, authMode: "fixture" });
    expect(headersOf(calls()[0][1])[CSRF_HEADER]).toBeUndefined();
  });

  it("throws a typed ApiError with validation errors", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: "invalidPack", message: "Fix the pack.", validationErrors: [{ path: "title", message: "Expected a non-empty string." }] }), {
          status: 400,
        }),
    );
    const error = await updatePack("t", "p1", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "invalidPack", message: "Fix the pack." });
    expect((error as ApiError).validationErrors).toEqual([{ path: "title", message: "Expected a non-empty string." }]);
  });

  it("turns network failures into a readable ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(getSession()).rejects.toMatchObject({ code: "network", status: 0 });
  });
});
