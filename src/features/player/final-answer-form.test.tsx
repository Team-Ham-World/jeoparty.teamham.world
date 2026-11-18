// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinalAnswerForm } from "./final-answer-form";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function submitMock(revision = 2) {
  return vi.fn<ComponentProps<typeof FinalAnswerForm>["onSubmit"]>(async () => revision);
}

describe("FinalAnswerForm", () => {
  it("automatically sends the first unsaved answer immediately", async () => {
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted={null}
        disabled={false}
        busy={false}
        autosaveUntil={Date.now() + 5000}
        onSubmit={onSubmit}
      />,
    );
    await act(async () =>
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } }),
    );
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lynx", true);
  });

  it("does not automatically send outside the autosave window", () => {
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted={null}
        disabled={false}
        busy={false}
        autosaveUntil={null}
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
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted={null}
        disabled={disabled}
        busy={busy}
        autosaveUntil={Date.now() + 5000}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not automatically send an unchanged submitted answer", () => {
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted="lynx"
        disabled={false}
        busy={false}
        autosaveUntil={Date.now() + 5000}
        onSubmit={onSubmit}
      />,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("follows a remote submission in an idle tab without sending the old answer", () => {
    const onSubmit = submitMock();
    const form = (submitted: string) => (
      <FinalAnswerForm
        revision={1}
        submitted={submitted}
        disabled={false}
        busy={false}
        autosaveUntil={Date.now() + 5000}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(form("lynx"));
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    rerender(form("bobcat"));
    act(() => vi.advanceTimersByTime(700));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("bobcat");
    expect(textarea).toHaveFocus();
    expect(screen.getByRole("button", { name: "Update answer" })).toBeDisabled();
  });

  it("keeps a local edit after a remote submission and preserves its spacing on confirmation", () => {
    const onSubmit = submitMock();
    const form = (submitted: string) => (
      <FinalAnswerForm
        revision={1}
        submitted={submitted}
        disabled={false}
        busy={false}
        autosaveUntil={null}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(form("lynx"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "snow leopard " } });

    rerender(form("bobcat"));
    expect(textarea).toHaveValue("snow leopard ");
    expect(screen.getByRole("button", { name: "Update answer" })).toBeEnabled();

    rerender(form("snow leopard"));
    expect(textarea).toHaveValue("snow leopard ");
    expect(screen.getByRole("button", { name: "Update answer" })).toBeDisabled();
    rerender(form("cougar"));
    expect(textarea).toHaveValue("cougar");
  });

  it("follows a newer remote answer even if the view skipped the local submission", async () => {
    const { promise, resolve } = Promise.withResolvers<number>();
    const onSubmit = submitMock().mockReturnValueOnce(promise);
    const form = (submitted: string, revision: number) => (
      <FinalAnswerForm
        revision={revision}
        submitted={submitted}
        disabled={false}
        busy={false}
        autosaveUntil={null}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(form("lynx", 1));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "snow leopard " } });
    fireEvent.click(screen.getByRole("button", { name: "Update answer" }));

    rerender(form("bobcat", 3));
    expect(textarea).toHaveValue("snow leopard ");
    await act(async () => resolve(2));
    expect(textarea).toHaveValue("bobcat");
    expect(screen.getByRole("button", { name: "Update answer" })).toBeDisabled();
  });

  it("sends the newest text when the cooldown ends without restarting it while typing", async () => {
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted={null}
        disabled={false}
        busy={false}
        autosaveUntil={Date.now() + 5000}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByRole("textbox");
    await act(async () => fireEvent.change(textarea, { target: { value: "ly" } }));
    act(() => vi.advanceTimersByTime(400));
    fireEvent.change(textarea, { target: { value: "lyn" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(textarea, { target: { value: "lynx" } });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("ly", true);
    await act(async () => vi.advanceTimersByTime(100));
    expect(onSubmit.mock.calls).toEqual([
      ["ly", true],
      ["lynx", true],
    ]);
  });

  it("keeps input focused while pending and sends the latest edit before lock", async () => {
    const { promise, resolve } = Promise.withResolvers<number | null>();
    const onSubmit = submitMock(3).mockReturnValueOnce(promise);
    const autosaveUntil = Date.now() + 400;
    const form = (submitted: string, busy: boolean, revision: number) => (
      <FinalAnswerForm
        revision={revision}
        submitted={submitted}
        disabled={false}
        busy={busy}
        autosaveUntil={autosaveUntil}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(form("lynx", false, 1));
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    fireEvent.change(textarea, { target: { value: "bobcat" } });
    rerender(form("lynx", true, 1));
    expect(screen.getByRole("button", { name: "Update answer" })).toBeDisabled();
    expect(textarea).toBeEnabled();
    fireEvent.change(textarea, { target: { value: "lynx " } });
    act(() => vi.advanceTimersByTime(250));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bobcat", true);

    await act(async () => resolve(2));
    await act(async () => rerender(form("bobcat", false, 2)));
    expect(onSubmit.mock.calls).toEqual([
      ["bobcat", true],
      ["lynx", true],
    ]);
    rerender(form("lynx", false, 3));
    expect(textarea).toHaveValue("lynx ");
    expect(textarea).toHaveFocus();
  });

  it("sends the completed word when the player types across the final 400 ms", async () => {
    const deadline = Date.now() + 400;
    let revision = 1;
    const onSubmit = vi.fn(async () => ++revision);
    render(
      <FinalAnswerForm
        revision={revision}
        submitted={null}
        disabled={false}
        busy={false}
        autosaveUntil={deadline}
        onSubmit={onSubmit}
      />,
    );
    for (const text of ["c", "ca", "cat"]) {
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
      });
      await act(() => vi.advanceTimersByTimeAsync(text === "cat" ? 99 : 150));
    }
    expect(onSubmit).toHaveBeenLastCalledWith("cat", true);
  });

  it("marks a button submission as manual", async () => {
    const onSubmit = submitMock();
    render(
      <FinalAnswerForm
        revision={1}
        submitted={null}
        disabled={false}
        busy={false}
        autosaveUntil={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lynx" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit answer" })));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lynx", false);
  });

  it.each([null, "lynx"])("shows the saving status with submitted=%s", (submitted) => {
    const { promise } = Promise.withResolvers<number | null>();
    const onSubmit = vi.fn(() => promise);
    render(
      <FinalAnswerForm
        revision={1}
        submitted={submitted}
        disabled={false}
        busy={false}
        autosaveUntil={Date.now() + 5000}
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
