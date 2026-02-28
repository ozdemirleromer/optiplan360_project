import { useState, type ReactNode } from "react";
import { Bell, ClipboardList, Factory, CheckCircle2, MessageSquare, Camera } from "lucide-react";
import { COLORS, TYPOGRAPHY, RADIUS, SHADOWS, Z_INDEX, primaryRgba } from "./constants";

// Types
interface Notification {
  id: number;
  icon: ReactNode;
  text: string;
  time: string;
  read: boolean;
}

const NOTIFICATIONS_DATA: Notification[] = [
  { id: 1, icon: <ClipboardList size={16} aria-hidden />, text: "Yeni sipariş: OP-2026-0848 oluşturuldu", time: "2 dk önce", read: false },
  { id: 2, icon: <Factory size={16} aria-hidden />, text: "OP-2026-0845 üretime alındı", time: "15 dk önce", read: false },
  { id: 3, icon: <CheckCircle2 size={16} color={COLORS.success.DEFAULT} aria-hidden />, text: "OP-2026-0842 kesim tamamlandı", time: "1 saat önce", read: true },
  { id: 4, icon: <MessageSquare size={16} aria-hidden />, text: "Ege Mutfak'a WhatsApp gönderildi", time: "2 saat önce", read: true },
  { id: 5, icon: <Camera size={16} aria-hidden />, text: "OCR: siparis_04.jpg işlendi", time: "3 saat önce", read: true },
];

export const NotificationDropdown = () => {
  const [open, setOpen] = useState(false);
  const unread = NOTIFICATIONS_DATA.filter((n) => !n.read).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "relative",
          background: "rgba(255,255,255,.05)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: "7px 10px",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          color: COLORS.muted,
          transition: "all .12s ease",
        }}
      >
        <Bell size={16} aria-label="Bildirimler" />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: "50%",
              background: COLORS.danger.DEFAULT,
              color: "#fff",
              fontSize: 9,
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "pulse-dot 1.5s ease-in-out infinite",
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.dropdown - 1 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 340,
              background: "rgba(9,9,11,.96)",
              backdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border2}`,
              borderRadius: RADIUS.xl,
              boxShadow: SHADOWS.lg,
              zIndex: Z_INDEX.dropdown,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.bold }}>
                Bildirimler
              </span>
              {unread > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: COLORS.primary[500],
                    cursor: "pointer",
                  }}
                >
                  Tümünü okundu işaretle
                </span>
              )}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {NOTIFICATIONS_DATA.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: n.read ? "transparent" : primaryRgba(0.04),
                    transition: "background .12s ease",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: n.read ? COLORS.muted : COLORS.text,
                        lineHeight: 1.4,
                      }}
                    >
                      {n.text}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 3 }}>
                      {n.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};
