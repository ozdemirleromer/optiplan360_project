/**
 * Payment Service - Tahsilat ve Ödeme Sözü API Client
 */

import { apiRequest } from "./apiClient";

// ══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════

export enum PaymentStatus {
  PENDING = "PENDING",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  CHECK = "CHECK",
  DEBIT = "DEBIT",
}

export enum PromiseStatus {
  PENDING = "PENDING",
  KEPT = "KEPT",
  BROKEN = "BROKEN",
  POSTPONED = "POSTPONED",
}

export enum ReminderType {
  EMAIL = "EMAIL",
  SMS = "SMS",
  IN_APP = "IN_APP",
  LETTER = "LETTER",
}

export enum ReminderStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  READ = "READ",
  IGNORED = "IGNORED",
  BOUNCED = "BOUNCED",
}

export type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  accountId: string;
  orderId?: number;
  quoteId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  issueDate: string;
  dueDate?: string;
  paymentCompletedAt?: string;
  notes?: string;
  // Ödeme Hatırlatıcısı Bilgileri
  reminderType?: string;
  reminderSent: boolean;
  reminderSentAt?: string;
  reminderStatus?: string;
  nextReminderDate?: string;
  reminderCount: number;
  createdAt: string;
};

export type Payment = {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  accountId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  paymentDate: string;
  checkNumber?: string;
  checkDate?: string;
  checkBank?: string;
  cardLast4?: string;
  transactionRef?: string;
  notes?: string;
  isCancelled: boolean;
  createdAt: string;
};

export type PaymentPromise = {
  id: string;
  invoiceId: string;
  accountId: string;
  promisedAmount: number;
  promiseDate: string;
  paymentMethod?: PaymentMethod;
  status: PromiseStatus;
  isFulfilled: boolean;
  fulfilledAt?: string;
  fulfilledPaymentId?: string;
  reminderSent: boolean;
  reminderSentAt?: string;
  contactPerson?: string;
  contactNote?: string;
  notes?: string;
  createdAt: string;
};

export type PaymentStatistics = {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  collectionRate: number;
  overdueInvoices: number;
  overdueAmount: number;
  pendingPromisesCount: number;
  pendingPromisesAmount: number;
  todayPromises: number;
  overduePromises: number;
};

export type AgingBucket = {
  label: string;
  daysRange: string;
  invoiceCount: number;
  totalAmount: number;
};

export type AgingReport = {
  buckets: AgingBucket[];
  totalRemaining: number;
};

// ══════════════════════════════════════════════════════════════
// INVOICE OPERATIONS
// ══════════════════════════════════════════════════════════════

export const invoiceService = {
  /**
   * Fatura listesi
   */
  async list(params?: {
    account_id?: string;
    status?: PaymentStatus;
    overdue_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Invoice[]> {
    const queryParams = new URLSearchParams();
    if (params?.account_id) queryParams.append("account_id", params.account_id);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.overdue_only) queryParams.append("overdue_only", "true");
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString());
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());

    return await apiRequest<Invoice[]>(`/payments/invoices?${queryParams}`);
  },

  /**
   * Fatura detayı
   */
  async get(invoiceId: string): Promise<Invoice> {
    return await apiRequest<Invoice>(`/payments/invoices/${invoiceId}`);
  },

  /**
   * Yeni fatura oluştur
   */
  async create(data: {
    account_id: string;
    order_id?: number;
    quote_id?: string;
    subtotal: number;
    tax_rate?: number;
    discount_amount?: number;
    total_amount: number;
    due_date?: string;
    invoice_type?: string;
    reminder_type?: string;
    next_reminder_date?: string;
    notes?: string;
  }): Promise<Invoice> {
    return await apiRequest<Invoice>("/payments/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Fatura güncelle
   */
  async update(invoiceId: string, data: Record<string, unknown>): Promise<Invoice> {
    return await apiRequest<Invoice>(`/payments/invoices/${invoiceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Fatura sil
   */
  async delete(invoiceId: string): Promise<void> {
    return await apiRequest<void>(`/payments/invoices/${invoiceId}`, {
      method: "DELETE",
    });
  },
};

// ══════════════════════════════════════════════════════════════
// PAYMENT OPERATIONS
// ══════════════════════════════════════════════════════════════

export const paymentService = {
  /**
   * Ödeme listesi
   */
  async list(params?: {
    invoice_id?: string;
    account_id?: string;
    payment_method?: PaymentMethod;
    skip?: number;
    limit?: number;
  }): Promise<Payment[]> {
    const queryParams = new URLSearchParams();
    if (params?.invoice_id) queryParams.append("invoice_id", params.invoice_id);
    if (params?.account_id) queryParams.append("account_id", params.account_id);
    if (params?.payment_method) queryParams.append("payment_method", params.payment_method);
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString());
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());

    return await apiRequest<Payment[]>(`/payments/payments?${queryParams}`);
  },

  /**
   * Yeni ödeme kaydı
   */
  async create(data: {
    invoice_id: string;
    account_id: string;
    payment_method: PaymentMethod;
    amount: number;
    payment_date?: string;
    check_number?: string;
    check_date?: string;
    check_bank?: string;
    card_last_4?: string;
    transaction_ref?: string;
    notes?: string;
  }): Promise<Payment> {
    return await apiRequest<Payment>("/payments/payments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Ödeme iptal
   */
  async cancel(paymentId: string): Promise<Payment> {
    return await apiRequest<Payment>(`/payments/payments/${paymentId}/cancel`, {
      method: "POST",
    });
  },
};

// ══════════════════════════════════════════════════════════════
// PAYMENT PROMISE OPERATIONS
// ══════════════════════════════════════════════════════════════

export const promiseService = {
  /**
   * Ödeme sözü listesi
   */
  async list(params?: {
    invoice_id?: string;
    account_id?: string;
    status?: PromiseStatus;
    overdue_only?: boolean;
    today_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<PaymentPromise[]> {
    const queryParams = new URLSearchParams();
    if (params?.invoice_id) queryParams.append("invoice_id", params.invoice_id);
    if (params?.account_id) queryParams.append("account_id", params.account_id);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.overdue_only) queryParams.append("overdue_only", "true");
    if (params?.today_only) queryParams.append("today_only", "true");
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString());
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());

    return await apiRequest<PaymentPromise[]>(`/payments/promises?${queryParams}`);
  },

  /**
   * Yeni ödeme sözü
   */
  async create(data: {
    invoice_id: string;
    account_id: string;
    promised_amount: number;
    promise_date: string;
    payment_method?: PaymentMethod;
    contact_person?: string;
    contact_note?: string;
    notes?: string;
  }): Promise<PaymentPromise> {
    return await apiRequest<PaymentPromise>("/payments/promises", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Ödeme sözü durumu güncelle
   */
  async updateStatus(
    promiseId: string,
    status: PromiseStatus,
    notes?: string
  ): Promise<PaymentPromise> {
    return await apiRequest<PaymentPromise>(`/payments/promises/${promiseId}`, {
      method: "PUT",
      body: JSON.stringify({ status, notes }),
    });
  },

  /**
   * Hatırlatma gönder
   */
  async sendReminder(promiseId: string): Promise<PaymentPromise> {
    return await apiRequest<PaymentPromise>(`/payments/promises/${promiseId}/remind`, {
      method: "POST",
    });
  },
};

// ══════════════════════════════════════════════════════════════
// STATISTICS & REPORTS
// ══════════════════════════════════════════════════════════════

export const paymentReportService = {
  /**
   * Tahsilat istatistikleri
   */
  async getStatistics(accountId?: string): Promise<PaymentStatistics> {
    const url = accountId
      ? `/payments/statistics?account_id=${accountId}`
      : "/payments/statistics";
    return await apiRequest<PaymentStatistics>(url);
  },

  /**
   * Yaşlandırma raporu
   */
  async getAgingReport(accountId?: string): Promise<AgingReport> {
    const url = accountId
      ? `/payments/aging-report?account_id=${accountId}`
      : "/payments/aging-report";
    return await apiRequest<AgingReport>(url);
  },
};

// ══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Ödeme durumu Türkçe etiketi
 */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: "Ödeme Bekliyor",
    [PaymentStatus.PARTIAL]: "Kısmi Ödendi",
    [PaymentStatus.PAID]: "Tamamen Ödendi",
    [PaymentStatus.OVERDUE]: "Vadesi Geçti",
    [PaymentStatus.CANCELLED]: "İptal Edildi",
  };
  return labels[status] || status;
}

/**
 * Ödeme yöntemi Türkçe etiketi
 */
export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: "Nakit",
    [PaymentMethod.CARD]: "Kredi Kartı",
    [PaymentMethod.TRANSFER]: "Havale/EFT",
    [PaymentMethod.CHECK]: "Çek",
    [PaymentMethod.DEBIT]: "Cari Hesaptan",
  };
  return labels[method] || method;
}

/**
 * Ödeme sözü durumu Türkçe etiketi
 */
export function getPromiseStatusLabel(status: PromiseStatus): string {
  const labels: Record<PromiseStatus, string> = {
    [PromiseStatus.PENDING]: "Bekliyor",
    [PromiseStatus.KEPT]: "Tutuldu",
    [PromiseStatus.BROKEN]: "Tutulmadı",
    [PromiseStatus.POSTPONED]: "Ertelendi",
  };
  return labels[status] || status;
}

/**
 * Para formatla (TRY)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

/**
 * Tarih formatla
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Tarih + Saat formatla
 */
export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
