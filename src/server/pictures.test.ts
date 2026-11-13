import { afterEach, describe, expect, it } from "vitest";
import { MAX_PICTURE_BYTES, parsePictureId, type QuestionPack } from "@/features/content";
import sample from "@/features/content/samples/sample-pack-3x3.json";
import { Browser, harness, type Harness } from "./test-harness";
import { Pictures } from "./pictures";
import { Packs } from "./packs";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
let h: Harness;
afterEach(async () => {
  await h?.stop();
});

async function setup() {
  h = await harness();
  const b = new Browser(h);
  await b.signIn("author");
  const owner = h.app.auth.identityFor(h.app.auth.sessionFromCookieHeader(b.cookie))!.account
    .account_id;
  return { b, owner };
}
function upload(b: Browser, bytes = jpeg, headers: Record<string, string> = {}) {
  return b.request("/api/pictures", {
    method: "POST",
    headers: {
      origin: h.app.config.publicOrigin,
      "x-quiz-csrf": b.csrf,
      "content-type": "image/jpeg",
      ...headers,
    },
    body: new Uint8Array(bytes),
  });
}

describe("picture HTTP routes", () => {
  it("stores a JPEG, deduplicates per owner, and serves public GET and HEAD with private caching", async () => {
    const { b } = await setup();
    const response = await upload(b);
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(parsePictureId(id)).toBe(id);
    expect(await (await upload(b)).json()).toEqual({ id });
    const other = new Browser(h);
    await other.signIn("other");
    const second = await (await upload(other)).json();
    expect(second.id).not.toBe(id);
    for (const method of ["GET", "HEAD"]) {
      const fetched = await fetch(`${h.base}/api/pictures/${id}`, { method });
      expect(fetched.status).toBe(200);
      expect(fetched.headers.get("content-type")).toBe("image/jpeg");
      expect(fetched.headers.get("content-length")).toBe(String(jpeg.length));
      expect(fetched.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
      expect(fetched.headers.get("cross-origin-resource-policy")).toBe("same-origin");
      expect(fetched.headers.get("x-content-type-options")).toBe("nosniff");
      expect(fetched.headers.get("content-security-policy")).toContain("img-src 'self'");
      expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(
        method === "GET" ? jpeg : new Uint8Array(),
      );
    }
  });
  it("requires sign-in, Origin and CSRF before it reads the binary body", async () => {
    const { b } = await setup();
    expect((await upload(new Browser(h))).status).toBe(403);
    expect((await upload(b, jpeg, { origin: "https://elsewhere.test" })).status).toBe(403);
    expect((await upload(b, jpeg, { "x-quiz-csrf": "bad" })).status).toBe(403);
    const oversized = new Uint8Array(MAX_PICTURE_BYTES + 1);
    expect((await upload(b, oversized, { origin: "https://elsewhere.test" })).status).toBe(403);
  });
  it("rejects empty bodies, non-JPEG content types and non-JPEG bytes", async () => {
    const { b } = await setup();
    expect((await upload(b, new Uint8Array())).status).toBe(400);
    expect((await upload(b, jpeg, { "content-type": "image/png" })).status).toBe(415);
    expect((await upload(b, new Uint8Array([137, 80, 78, 71]))).status).toBe(415);
  });
  it("caps both declared and chunked bodies at 1 MiB", async () => {
    const { b } = await setup();
    const oversized = new Uint8Array(MAX_PICTURE_BYTES + 1);
    expect((await upload(b, oversized)).status).toBe(413);
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        cookie: b.cookie,
        origin: h.app.config.publicOrigin,
        "x-quiz-csrf": b.csrf,
        "content-type": "image/jpeg",
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(oversized);
          controller.close();
        },
      }),
      duplex: "half",
    };
    const response = await fetch(`${h.base}/api/pictures`, init);
    expect(response.status).toBe(413);
    const largest = new Uint8Array(MAX_PICTURE_BYTES);
    largest.set(jpeg);
    expect((await upload(b, largest)).status).toBe(201);
  });
  it("limits uploads per account to 30 per minute", async () => {
    const { b } = await setup();
    for (let i = 0; i < 30; i++) expect((await upload(b)).status).toBe(201);
    expect((await upload(b)).status).toBe(429);
    h.advance(60_001);
    expect((await upload(b)).status).toBe(201);
  });
  it("returns 404 for bad or unknown ids and 405 for unsupported methods", async () => {
    const { b } = await setup();
    for (const id of ["bad", `pic_${"a".repeat(43)}`]) {
      for (const method of ["GET", "HEAD"])
        expect((await b.request(`/api/pictures/${id}`, { method })).status).toBe(404);
    }
    for (const [path, method] of [
      ["/api/pictures", "GET"],
      ["/api/pictures", "PUT"],
      ["/api/pictures/bad", "POST"],
      ["/api/pictures/bad", "DELETE"],
    ]) {
      expect((await b.request(path, { method })).status).toBe(405);
    }
  });
  it("rejects another owner's picture at each field path and permits same-owner duplication", async () => {
    const { b } = await setup();
    const { id } = await (await upload(b)).json();
    const pack = structuredClone(sample);
    Object.assign(pack.categories[0].clues[0], { picture: { id, alt: "" } });
    Object.assign(pack.categories[0].finalClue, { picture: { id, alt: "" } });
    const saved = await b.mutate("/api/packs", { pack });
    expect(saved.status).toBe(201);
    const doc = await saved.json();
    expect((await b.mutate(`/api/packs/${doc.id}/duplicate`)).status).toBe(201);
    const other = new Browser(h);
    await other.signIn("other");
    const rejected = await other.mutate("/api/packs", { pack });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({
      error: "invalidPack",
      validationErrors: [
        {
          path: "categories[0].clues[0].picture",
          message: "This picture isn't in your account any more. Add it again.",
        },
        {
          path: "categories[0].finalClue.picture",
          message: "This picture isn't in your account any more. Add it again.",
        },
      ],
    });
  });
});

describe("picture storage", () => {
  it("counts bytes once per owner, rejects quota overflow, and refreshes an existing upload's grace", async () => {
    const { owner } = await setup();
    let now = 1;
    const pictures = new Pictures(h.app.db, () => now, {
      maxAccountBytes: jpeg.length,
      graceMs: 100,
    });
    const id = pictures.add(owner, "image/jpeg", jpeg);
    expect(pictures.ownedIds(owner)).toEqual(new Set([id]));
    expect(() => pictures.add(owner, "image/jpeg", new Uint8Array([...jpeg, 4]))).toThrowError(
      expect.objectContaining({ status: 409, code: "conflict" }),
    );
    now = 200;
    expect(pictures.add(owner, "image/jpeg", jpeg)).toBe(id);
    expect(pictures.sweep()).toBe(0);
    now = 301;
    expect(pictures.sweep()).toBe(1);
    expect(pictures.bytes(id)).toBeNull();
  });
  it("keeps references in packs, rooms, escaped JSON and malformed quarantine while sweeping old orphans", async () => {
    const { owner } = await setup();
    let now = 0;
    const pictures = new Pictures(h.app.db, () => now, { maxAccountBytes: 1000, graceMs: 100 });
    const ids = Array.from({ length: 7 }, (_, i) =>
      pictures.add(owner, "image/jpeg", new Uint8Array([...jpeg, i])),
    );
    const [packId, roomId, quarantinedId, escapedId, malformedId, orphanId] = ids;
    const pack: QuestionPack = new Packs(h.app.db, pictures).resolve(sample.id, owner);
    pack.categories[0].clues[0].picture = { id: packId, alt: "" };
    new Packs(h.app.db, pictures).save(pack, owner);
    h.app.db.run(
      "INSERT INTO rooms(code, host_id, state_json, recent_json, updated_at) VALUES ('BCDFG', ?, ?, '[]', 0)",
      owner,
      JSON.stringify({ nested: [{ picture: { id: roomId } }], note: `prefix${ids[6]}` }),
    );
    for (const [code, json] of [
      ["BCDFH", JSON.stringify({ picture: quarantinedId })],
      ["BCDFJ", JSON.stringify({ picture: escapedId }).replace("pic_", "\\u0070ic_")],
      ["BCDFK", `broken JSON ${malformedId}`],
    ])
      h.app.db.run(
        "INSERT INTO quarantined_rooms(code, host_id, state_json, recent_json, updated_at) VALUES (?, ?, ?, '[]', 0)",
        code,
        owner,
        json,
      );
    now = 100;
    expect(pictures.sweep()).toBe(0);
    now = 101;
    const freshId = pictures.add(owner, "image/jpeg", new Uint8Array([...jpeg, 9]));
    expect(pictures.sweep()).toBe(2);
    expect(pictures.sweep()).toBe(0);
    for (const id of [packId, roomId, quarantinedId, escapedId, malformedId, freshId])
      expect(pictures.bytes(id)).not.toBeNull();
    expect(pictures.bytes(orphanId)).toBeNull();
    h.app.db.run("DELETE FROM packs");
    h.app.db.run("DELETE FROM rooms");
    h.app.db.run("DELETE FROM quarantined_rooms");
    expect(pictures.sweep()).toBe(5);
  });
});
