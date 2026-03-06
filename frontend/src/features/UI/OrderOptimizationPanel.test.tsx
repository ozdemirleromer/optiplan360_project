import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderOptimizationPanel } from "../Orders/OrderOptimization/OrderOptimizationPanel";

describe("OrderOptimizationPanel", () => {
  it("renders restored detail actions and triggers their handlers", async () => {
    const user = userEvent.setup();
    const onOpenImport = vi.fn();
    const onExportCsv = vi.fn();
    const onSave = vi.fn();
    const onOptimize = vi.fn();
    const onDelete = vi.fn();

    render(
      <OrderOptimizationPanel
        themeMode="light"
        activeTab="siparis"
        customerValue="ACME | 5551234567"
        customerName="ACME"
        customerPhone="5551234567"
        orderNo="SIP-0001"
        orderStatus="Yeni"
        dueDate="2026-03-04"
        plateBoy="2800"
        plateEn="2100"
        material="Beyaz MDF"
        thickness={18}
        priority="normal"
        customerSuggestions={["ACME | 5551234567"]}
        items={[
          {
            id: 1,
            boy: "720",
            en: "450",
            adet: "2",
            grain: "0",
            u1: false,
            u2: false,
            k1: false,
            k2: false,
            delik1: "",
            delik2: "",
            info: "Yan panel",
            material: "Beyaz MDF",
            thickness: "18",
            status: "NEW",
          },
        ]}
        notice={{ text: "Yeni / Operator", tone: "default" }}
        messages={[{ tone: "success", text: "1 row imported." }]}
        totalParts={2}
        estimatedArea="0.65"
        validationState="valid"
        canDelete
        validationErrors={[]}
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onCustomerChange={vi.fn()}
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onDueDateChange={vi.fn()}
        onPlateBoyChange={vi.fn()}
        onPlateEnChange={vi.fn()}
        onPlateBoyBlur={vi.fn()}
        onPlateEnBlur={vi.fn()}
        onMaterialChange={vi.fn()}
        onThicknessChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onItemChange={vi.fn()}
        onAddItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onDuplicateItem={vi.fn()}
        onSave={onSave}
        onOptimize={onOptimize}
        onValidate={vi.fn()}
        onOpenImport={onOpenImport}
        onExportCsv={onExportCsv}
        onExportExcel={vi.fn()}
        onPrint={vi.fn()}
        onDownloadTemplate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("1 row imported.")).toBeInTheDocument();
    expect(screen.getByText(/0.65/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Aktar/i }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    await user.click(screen.getAllByRole("button", { name: "Kaydet" }).at(-1)!);
    await user.click(screen.getByRole("button", { name: /OPT/i }));
    await user.click(screen.getByRole("button", { name: "Sil" }));

    expect(onOpenImport).toHaveBeenCalledTimes(1);
    expect(onExportCsv).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOptimize).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
