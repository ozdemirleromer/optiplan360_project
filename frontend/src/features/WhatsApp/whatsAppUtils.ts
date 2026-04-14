/**
 * WhatsApp Business — Saf yardımcı fonksiyonlar ve sabitler
 */

import { COLORS, TYPOGRAPHY } from "../../components/Shared";
import type { WhatsAppMessage, WhatsAppSummary, TabId, MessageFilterId } from "./whatsAppTypes";

// ── Durum renk haritası ───────────────────────────────────────
export const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  SENT: { bg: COLORS.success, color: COLORS.success, label: "Gönderildi" },
  FAILED: { bg: COLORS.danger, color: COLORS.danger, label: "Başarısız" },
  PENDING: { bg: COLORS.warning, color: COLORS.warning, label: "Bekliyor" },
};

// ── Sekme tanımları (JSX içermediği için burada) ──────────────
export const TAB_IDS: TabId[] = ["overview", "config", "send", "history", "templates"];

export const TAB_LABELS: Record<TabId, string> = {
  overview: "Genel Bakış",
  config: "Yapılandırma",
  send: "Mesaj Gönder",
  history: "Mesaj Geçmişi",
  templates: "Şablon Yönetimi",
};

// ── Filtre buton tanımları ────────────────────────────────────
export const FILTER_BUTTONS: { id: MessageFilterId; label: string; color: string }[] = [
  { id: "ALL", label: "Tümü", color: COLORS.text },
  { id: "SENT", label: "Gönderildi", color: COLORS.success },
  { id: "FAILED", label: "Başarısız", color: COLORS.danger },
  { id: "PENDING", label: "Bekliyor", color: COLORS.warning },
];

// ── Ortak input stil nesnesi ──────────────────────────────────
import { RADIUS } from "../../components/Shared";
import type React from "react";

export function buildInputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: RADIUS.md,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg.surface,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.base,
    outline: "none",
    transition: "border-color 0.15s ease",
    boxSizing: "border-box",
  };
}

export function buildLabelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
}

// ── Mesaj başarı oranı hesaplama ─────────────────────────────
export function calcSuccessRate(summary: WhatsAppSummary | null): string {
  if (!summary || summary.totalSent === 0) return "%0";
  return `%${Math.round(((summary.totalSent - summary.failed) / summary.totalSent) * 100)}`;
}

// ── Mesaj filtreleme ─────────────────────────────────────────
export function filterMessages(
  messages: WhatsAppMessage[],
  filter: MessageFilterId,
  search: string
): WhatsAppMessage[] {
  return messages.filter((m) => {
    if (filter !== "ALL" && m.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.toPhone.includes(q) ||
        m.message.toLowerCase().includes(q) ||
        (m.sentBy && m.sentBy.toLowerCase().includes(q)) ||
        (m.orderTsCode && m.orderTsCode.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

// ── Backend response → WhatsAppMessage map ───────────────────
export function mapToWhatsAppMessage(m: Record<string, unknown>): WhatsAppMessage {
  return {
    id: String(m.id ?? ""),
    toPhone: String(m.toPhone ?? ""),
    message: String(m.message ?? ""),
    status: String(m.status ?? ""),
    wabaMessageId: m.wabaMessageId ? String(m.wabaMessageId) : undefined,
    orderId: m.orderId ? String(m.orderId) : undefined,
    orderTsCode: m.orderTsCode ? String(m.orderTsCode) : undefined,
    sentBy: String(m.sentBy ?? ""),
    sentAt: String(m.sentAt ?? ""),
    error: m.error ? String(m.error) : undefined,
  };
}
