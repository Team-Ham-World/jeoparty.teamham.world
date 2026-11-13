import { vi } from "vitest";

export interface Encoding {
  width: number;
  height: number;
  quality: number | undefined;
}

export function fakeBrowserImages({
  width = 3200,
  height = 2400,
  jpegSizes = [] as number[],
  decodes = true,
} = {}) {
  const encoded: Encoding[] = [];
  const painted: string[] = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      if (!decodes) throw new DOMException("The source image could not be decoded.");
      return { width, height, close: () => {} };
    }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const context = {
      fillStyle: "",
      fillRect: () => painted.push(`fill ${context.fillStyle}`),
      drawImage: () => painted.push("picture"),
    };
    return context as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
    quality,
  ) {
    encoded.push({ width: this.width, height: this.height, quality });
    const size = jpegSizes[encoded.length - 1] ?? 10;
    callback(new Blob([new Uint8Array(size)], { type }));
  });
  return { encoded, painted };
}
