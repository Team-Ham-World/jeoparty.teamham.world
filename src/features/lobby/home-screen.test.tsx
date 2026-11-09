// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PACKS, SESSION_SIGNED_IN, SESSION_SIGNED_OUT } from "@/features/preview/fixtures";
import { SignInNotice } from "@/features/ui/page-chrome";
import { HomeScreen, normalizeRoomCode } from "./home-screen";

afterEach(() => window.history.replaceState(null, "", "/"));

function signedOutHome() {
  render(
    <HomeScreen
      session={SESSION_SIGNED_OUT}
      packs={null}
      onCreateGame={async () => {}}
      onJoin={() => {}}
      onSignOut={() => {}}
    />,
  );
}

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
    // A hint, not a placeholder, so the empty field never looks filled in.
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAccessibleDescription("5 letters, no vowels.");
    fireEvent.change(input, { target: { value: "bcd" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("5 letters");
    expect(input).toHaveAccessibleDescription(/no vowels\. Room codes are 5 letters/);
    fireEvent.change(input, { target: { value: "bcdfg" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoin).toHaveBeenCalledWith("BCDFG");
  });

  it.each([
    ["denied", "Sign-in was cancelled."],
    ["expired", "That sign-in took too long. Try again."],
    ["state", "We couldn't finish signing you in. Try again."],
  ])("explains a failed sign-in (%s) and clears it from the address", (code, message) => {
    window.history.replaceState(null, "", `/?auth_error=${code}&keep=1#top`);
    signedOutHome();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/?keep=1#top",
    );
  });

  it("shows no sign-in error without the parameter", () => {
    signedOutHome();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a failed sign-in on the sign-in notice too", () => {
    window.history.replaceState(null, "", "/packs?auth_error=denied");
    render(<SignInNotice returnTo="/packs" authMode="live" title="Sign in" body="Body" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in was cancelled.");
    expect(window.location.search).toBe("");
  });
});
