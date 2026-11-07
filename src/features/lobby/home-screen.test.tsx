// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PACKS, SESSION_SIGNED_IN, SESSION_SIGNED_OUT } from "@/features/preview/fixtures";
import { HomeScreen, normalizeRoomCode } from "./home-screen";

describe("home", () => {
  it("normalizes typed room codes", () => {
    expect(normalizeRoomCode("bc d-fg")).toBe("BCDFG");
    expect(normalizeRoomCode("aeiou")).toBe("");
  });

  it("signed out: offers Sign in with HAM back to / and marks the dev fixture", () => {
    render(
      <HomeScreen
        session={SESSION_SIGNED_OUT}
        packs={null}
        onCreateGame={async () => {}}
        onJoin={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in with HAM" })).toHaveAttribute(
      "href",
      "/api/auth/login?return_to=%2F",
    );
    expect(screen.getAllByText("Dev sign-in fixture · not live HAM").length).toBeGreaterThan(0);
  });

  it("signed in: joins with a valid code and explains a bad one", () => {
    const onJoin = vi.fn();
    render(
      <HomeScreen
        session={SESSION_SIGNED_IN}
        packs={PACKS}
        onCreateGame={async () => {}}
        onJoin={onJoin}
        onSignOut={() => {}}
      />,
    );
    const input = screen.getByLabelText("Room code");
    fireEvent.change(input, { target: { value: "bcd" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("5 letters");
    fireEvent.change(input, { target: { value: "bcdfg" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoin).toHaveBeenCalledWith("BCDFG");
  });
});
