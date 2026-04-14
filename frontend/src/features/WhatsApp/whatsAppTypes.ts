/**
 * WhatsApp Business — TypeScript tip tanımları
 */

export interface WhatsAppTemplate {
  name: string;
  label: string;
  body: string;
  variables: string[];
}

export interface WhatsAppMessage {
  id: string;
  toPhone: string;
  message: string;
  status: string;
  wabaMessageId?: string;
  orderId?: string;
  orderTsCode?: string;
  sentBy: string;
  sentAt: string;
  error?: string;
}

export interface WhatsAppSummary {
  configured: boolean;
  totalSent: number;
  todaySent: number;
  failed: number;
}

export type TabId = "overview" | "config" | "send" | "history" | "templates";

export type MessageFilterId = "ALL" | "SENT" | "FAILED" | "PENDING";
