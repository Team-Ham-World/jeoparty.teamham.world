// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinalAnswerForm } from "./final-answer-form";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("FinalAnswerForm", () => {
  it("automatically sends an unsaved answer after 700 ms", () => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={null}
        disabled={false}
        busy={false}
        autosave={true}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    act(() => vi.advanceTimersByTime(700));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lynx", true);
  });

  it("does not automatically send outside the autosave window", () => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={null}
        disabled={false}
        busy={false}
        autosave={false}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    { disabled: true, busy: false },
    { disabled: false, busy: true },
  ])("does not automatically send with disabled=$disabled and busy=$busy", ({ disabled, busy }) => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={null}
        disabled={disabled}
        busy={busy}
        autosave={true}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not automatically send an unchanged submitted answer", () => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted="lynx"
        disabled={false}
        busy={false}
        autosave={true}
        onSubmit={onSubmit}
      />,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends the newest text without restarting the delay while typing", () => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={null}
        disabled={false}
        busy={false}
        autosave={true}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "ly" } });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.change(textarea, { target: { value: "lynx" } });
    act(() => vi.advanceTimersByTime(300));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lynx", true);
  });

  it("marks a button submission as manual", () => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={null}
        disabled={false}
        busy={false}
        autosave={false}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lynx", false);
  });

  it.each([null, "lynx"])("shows the saving status with submitted=%s", (submitted) => {
    const onSubmit = vi.fn();
    render(
      <FinalAnswerForm
        submitted={submitted}
        disabled={false}
        busy={false}
        autosave={true}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bobcat" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Time is almost up. Saving what you typed.",
    );
    expect(screen.queryByText("You have unsaved changes.")).not.toBeInTheDocument();
  });
});
