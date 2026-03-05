import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ToastProvider } from "../../contexts/ToastContext";
import { PaymentStatus, ReminderType, invoiceService, type Invoice } from "../../services/paymentService";
import ReminderPanel from "./ReminderPanel";

vi.mock("../../services/paymentService", async () => {
  const actual = await vi.importActual<typeof import("../../services/paymentService")>(
    "../../services/paymentService",
  );

  return {
    ...actual,
    invoiceService: {
      ...actual.invoiceService,
      sendReminder: vi.fn(),
    },
  };
});

const reminderInvoice: Invoice = {
  id: "inv-001",
  invoiceNumber: "INV-2026-00001",
  invoiceType: "SALES",
  accountId: "acc-1",
  subtotal: 1000,
  taxAmount: 200,
  discountAmount: 0,
  totalAmount: 1200,
  paidAmount: 0,
  remainingAmount: 1200,
  status: PaymentStatus.PENDING,
  issueDate: "2026-03-01T00:00:00.000Z",
  reminderType: ReminderType.EMAIL,
  reminderSent: false,
  reminderStatus: "PENDING",
  nextReminderDate: "2026-03-10T00:00:00.000Z",
  reminderCount: 0,
  createdAt: "2026-03-01T00:00:00.000Z",
};

describe("ReminderPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls invoice reminder endpoint and refreshes invoices", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(invoiceService.sendReminder).mockResolvedValue({
      ...reminderInvoice,
      reminderSent: true,
      reminderStatus: "SENT",
      reminderCount: 1,
    });

    render(
      <ToastProvider>
        <ReminderPanel invoices={[reminderInvoice]} onRefresh={onRefresh} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /şimdi gönder/i }));

    await waitFor(() => expect(invoiceService.sendReminder).toHaveBeenCalledWith("inv-001"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });
});
