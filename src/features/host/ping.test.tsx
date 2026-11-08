// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PingChip, SLOW_PING_MS, pingStatus } from "./ping";

describe("pingStatus", () => {
  it("says measuring before the first sample", () => {
    expect(pingStatus(null)).toEqual({
      kind: "measuring",
      text: "measuring…",
      label: "Ping: measuring",
    });
  });

  it("shows a quiet whole number of milliseconds", () => {
    expect(pingStatus(37.6)).toMatchObject({ kind: "ok", text: "38 ms" });
  });

  it("marks slow only above the threshold, and says so in words", () => {
    expect(SLOW_PING_MS).toBe(250);
    expect(pingStatus(250)).toMatchObject({ kind: "ok", text: "250 ms" });
    expect(pingStatus(251)).toMatchObject({
      kind: "slow",
      text: "251 ms · slow",
      label: "Ping 251 ms, slow",
    });
  });

  it("groups thousands", () => {
    expect(pingStatus(1240).text).toBe("1,240 ms · slow");
  });
});

describe("PingChip", () => {
  it("gives screen readers a sentence, not bare digits", () => {
    render(<PingChip ms={312} connected />);
    expect(screen.getByText("Ping 312 ms, slow")).toHaveClass("sr-only");
    expect(screen.getByText("312 ms · slow")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows nothing for an away phone, whose tag already explains it", () => {
    const { container } = render(<PingChip ms={null} connected={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
