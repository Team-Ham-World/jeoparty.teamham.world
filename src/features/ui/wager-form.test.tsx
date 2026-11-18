// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WagerForm } from "./wager-form";

it("keeps invalid pasted wagers visible until the player corrects them", () => {
  const submit = vi.fn();
  render(
    <WagerForm min={0} max={2000} disabled={false} submitLabel="Submit wager" onSubmit={submit} />,
  );
  const input = screen.getByLabelText("Your wager");
  const button = screen.getByRole("button", { name: "Submit wager" });
  for (const text of ["12.50", "-5", "1e3"]) {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.click(button);
    expect(input).toHaveValue(text);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number");
    expect(submit).not.toHaveBeenCalled();
  }
  fireEvent.change(input, { target: { value: "125" } });
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledExactlyOnceWith(125);
});
