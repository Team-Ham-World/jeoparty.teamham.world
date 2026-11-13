// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PICTURE_BYTES, type PictureId } from "@/features/content";
import { fakeBrowserImages } from "@/test/fake-images";
import { firstImageFile, storePicture } from "./picture-field";

const ID = `pic_${"a".repeat(43)}` as PictureId;
const photo = () => new File(["png bytes"], "barn.png", { type: "image/png" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("storePicture", () => {
  it("uploads a JPEG at most 1600 px on its long edge, painted on white", async () => {
    const { encoded, painted } = fakeBrowserImages({ width: 3200, height: 2400 });
    const upload = vi.fn<(jpeg: Blob) => Promise<PictureId>>(async () => ID);
    await expect(storePicture(photo(), upload)).resolves.toBe(ID);
    expect(encoded).toEqual([{ width: 1600, height: 1200, quality: 0.82 }]);
    expect(painted).toEqual(["fill #ffffff", "picture"]);
    expect(upload.mock.calls[0][0].type).toBe("image/jpeg");
  });

  it("keeps a small picture at its own size", async () => {
    const { encoded } = fakeBrowserImages({ width: 400, height: 300 });
    await storePicture(photo(), async () => ID);
    expect(encoded).toEqual([{ width: 400, height: 300, quality: 0.82 }]);
  });

  it("tries once more, smaller, when the JPEG is over the size limit", async () => {
    const { encoded } = fakeBrowserImages({ jpegSizes: [MAX_PICTURE_BYTES + 1, 500_000] });
    const upload = vi.fn<(jpeg: Blob) => Promise<PictureId>>(async () => ID);
    await storePicture(photo(), upload);
    expect(encoded).toEqual([
      { width: 1600, height: 1200, quality: 0.82 },
      { width: 1200, height: 900, quality: 0.7 },
    ]);
    expect(upload.mock.calls[0][0].size).toBe(500_000);
  });

  it("gives up without uploading when even the smaller JPEG is too big", async () => {
    fakeBrowserImages({ jpegSizes: [MAX_PICTURE_BYTES + 1, MAX_PICTURE_BYTES + 1] });
    const upload = vi.fn(async () => ID);
    await expect(storePicture(photo(), upload)).rejects.toThrow(
      "barn.png is too detailed to upload. Try a smaller picture.",
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("names a file the browser can't open", async () => {
    fakeBrowserImages({ decodes: false });
    const notes = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(storePicture(notes, async () => ID)).rejects.toThrow(
      "notes.txt isn't a picture this browser can open.",
    );
  });
});

describe("firstImageFile", () => {
  it("takes the first image and ignores other files", () => {
    const text = new File(["x"], "a.txt", { type: "text/plain" });
    const image = photo();
    expect(firstImageFile([text, image])).toBe(image);
    expect(firstImageFile([text])).toBeNull();
    expect(firstImageFile(undefined)).toBeNull();
  });
});
