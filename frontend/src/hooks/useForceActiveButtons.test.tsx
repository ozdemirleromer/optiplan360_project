import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useForceActiveButtons } from "./useForceActiveButtons";

function ForceActiveButtonsFixture({ onClick }: { onClick: () => void }) {
  useForceActiveButtons();

  return (
    <div>
      <button disabled onClick={onClick} type="button">
        Disabled Native Button
      </button>
      <div aria-disabled="true" data-testid="pseudo-button" role="button" tabIndex={0}>
        Pseudo Button
      </div>
    </div>
  );
}

describe("useForceActiveButtons", () => {
  it("removes disabled state from DOM buttons", async () => {
    const handleClick = vi.fn();

    render(<ForceActiveButtonsFixture onClick={handleClick} />);

    const button = screen.getByRole("button", { name: "Disabled Native Button" });

    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-force-enabled", "true");
  });

  it("clears aria-disabled from role buttons", async () => {
    render(<ForceActiveButtonsFixture onClick={() => undefined} />);

    const pseudoButton = screen.getByTestId("pseudo-button");

    await waitFor(() => expect(pseudoButton).not.toHaveAttribute("aria-disabled"));
    expect(pseudoButton).toHaveAttribute("data-force-enabled", "true");
  });
});
