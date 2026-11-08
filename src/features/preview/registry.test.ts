import { describe, expect, it } from "vitest";
import { PREVIEWS, findPreview } from "./registry";

describe("preview registry", () => {
  it("gives every preview a unique id, so each one can be opened at /preview/ID", () => {
    const ids = PREVIEWS.map((entry) => entry.id);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
  });

  it("finds the room-closed host state and the link-replaced TV state", () => {
    expect(findPreview("host-room-closed")?.title).toBe("Closed: room closed");
    expect(findPreview("display-link-replaced")?.title).toBe("Closed: display link replaced");
  });
});
