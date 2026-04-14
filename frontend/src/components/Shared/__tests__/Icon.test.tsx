// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "../Icon";

describe("Icon", () => {
  it("name prop ile ikon render eder", () => {
    const { container } = render(<Icon name="home" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("aria-label ozelligini SVG uzerine uygular", () => {
    const { container } = render(<Icon name="search" aria-label="Arama simgesi" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "Arama simgesi");
  });

  it("className degerini SVG uzerinde korur", () => {
    const { container } = render(<Icon name="info" className="icon-info" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("icon-info");
  });

  it("size prop ile genislik/yukseklik uygular", () => {
    const { container } = render(<Icon name="alertTriangle" size="lg" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
  });

  it("sayisal size degerini destekler", () => {
    const { container } = render(<Icon name="checkCircle" size={28} />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "28");
    expect(svg).toHaveAttribute("height", "28");
  });

  it("gecersiz name verilirse null doner", () => {
    const { container } = render(<Icon name={"__invalid__" as never} />);

    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("className ve aria-label birlikte calisir", () => {
    const { container } = render(<Icon name="info" className="custom-class" aria-label="Bilgi" />);

    expect(container.querySelector("svg")).toHaveClass("custom-class");
    expect(screen.getByLabelText("Bilgi")).toBeInTheDocument();
  });
});
