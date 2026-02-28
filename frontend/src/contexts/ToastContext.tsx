import { createContext, useContext, useState, useRef, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { COLORS, RADIUS, SHADOWS, Z_INDEX, TYPOGRAPHY } from "../components/Shared/constants";

interface Toast {
  id: number;
  msg: string;
  type: string;
}

interface ToastContextType {
  addToast: (msg: string, type?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  addToast: (_msg: string, _type?: string) => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((msg: string, type = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000
    );
  }, []);

  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; icon: JSX.Element }
  > = {
    success: {
      bg: "rgba(43,212,167,.14)",
      border: COLORS.success.DEFAULT,
      text: COLORS.success.dark,
      icon: <CheckCircle2 size={18} />,
    },
    error: {
      bg: "rgba(255,90,106,.14)",
      border: COLORS.error.DEFAULT,
      text: COLORS.error.dark,
      icon: <XCircle size={18} />,
    },
    warning: {
      bg: "rgba(247,201,72,.14)",
      border: COLORS.warning.DEFAULT,
      text: COLORS.warning.dark,
      icon: <AlertTriangle size={18} />,
    },
    info: {
      bg: "rgba(99,179,255,.14)",
      border: COLORS.info.DEFAULT,
      text: COLORS.info.dark,
      icon: <Info size={18} />,
    },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: Z_INDEX.toast,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const c = colorMap[t.type] || colorMap.info;
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                borderRadius: RADIUS.lg,
                background: c.bg,
                backdropFilter: "blur(16px)",
                border: `1px solid ${c.border}40`,
                color: c.text,
                boxShadow: SHADOWS.lg,
                overflow: "hidden",
                animation: "slideIn 0.3s ease-out",
                minWidth: 300,
              }}
            >
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  fontWeight: TYPOGRAPHY.fontWeight.medium,
                }}
              >
                <span>{c.icon}</span>
                <span style={{ flex: 1 }}>{t.msg}</span>
                <button
                  onClick={() =>
                    setToasts((prev) => prev.filter((x) => x.id !== t.id))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: c.text,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ height: 3, background: "rgba(0,0,0,.15)" }}>
                <div
                  style={{
                    height: "100%",
                    background: c.border,
                    animation: "toastProgress 4s linear forwards",
                    borderRadius: "0 2px 2px 0",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
