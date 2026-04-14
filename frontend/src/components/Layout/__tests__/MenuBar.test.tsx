// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MenuBar } from "../MenuBar";

describe("MenuBar", () => {
  it("dosya, cari ve siparis butonlarini paylasilan route metasina baglar", () => {
    const onNav = vi.fn();

    render(<MenuBar page="orders" onNav={onNav} />);

    fireEvent.click(screen.getByRole("button", { name: "Dosya" }));
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    fireEvent.click(screen.getByRole("button", { name: "Sipariş" }));

    expect(onNav).toHaveBeenNthCalledWith(1, "orders");
    expect(onNav).toHaveBeenNthCalledWith(2, "card-management");
    expect(onNav).toHaveBeenNthCalledWith(3, "order-editor");
  });

  it("aktif siparis sekmesini vurgular", () => {
    render(<MenuBar page="order-editor" onNav={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Sipariş" })).toHaveClass("is-active");
  });
});
