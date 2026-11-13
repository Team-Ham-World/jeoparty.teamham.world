// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CluePicture } from "./clue-picture";

describe("clue picture", () => {
  it("names a picture that has no description", () => {
    render(<CluePicture picture={{ src: "/api/pictures/a", alt: "" }} className="x" />);
    expect(screen.getByRole("img", { name: "Picture for this clue" })).toHaveAttribute(
      "src",
      "/api/pictures/a",
    );
  });

  it("says when a picture fails to load, and tries again for the next picture", () => {
    const { rerender } = render(
      <CluePicture picture={{ src: "/api/pictures/a", alt: "A red barn" }} className="x" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "A red barn" }));
    expect(screen.getByText("Picture didn't load")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.body).not.toHaveTextContent("A red barn");

    rerender(
      <CluePicture picture={{ src: "/api/pictures/b", alt: "A blue boat" }} className="x" />,
    );
    expect(screen.getByRole("img", { name: "A blue boat" })).toHaveAttribute(
      "src",
      "/api/pictures/b",
    );
    expect(screen.queryByText("Picture didn't load")).toBeNull();
  });

  it("tries a picture again when it comes back after another one", () => {
    const a = { src: "/api/pictures/a", alt: "A red barn" };
    const { rerender } = render(<CluePicture picture={a} className="x" />);
    fireEvent.error(screen.getByRole("img", { name: "A red barn" }));
    rerender(
      <CluePicture picture={{ src: "/api/pictures/b", alt: "A blue boat" }} className="x" />,
    );
    rerender(<CluePicture picture={a} className="x" />);
    expect(screen.getByRole("img", { name: "A red barn" })).toHaveAttribute("src", a.src);
    expect(screen.queryByText("Picture didn't load")).toBeNull();
  });
});
