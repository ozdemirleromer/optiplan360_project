import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface WhatsAppConfigModalProps {
     isOpen: boolean;
     onClose: () => void;
     onSave: (config: WhatsAppConfig) => void;
     initialConfig?: WhatsAppConfig;
}

export interface WhatsAppConfig {
     phoneNumberId: string;
     businessAccountId: string;
     accessToken: string;
     apiVersion: string;
}

const defaultConfig: WhatsAppConfig = {
     phoneNumberId: "",
     businessAccountId: "",
     accessToken: "",
     apiVersion: "v17.0",
};

export function WhatsAppConfigModal({ isOpen, onClose, onSave, initialConfig }: WhatsAppConfigModalProps) {
     const modalRef = useRef<HTMLDivElement>(null);
     const [config, setConfig] = useState<WhatsAppConfig>(initialConfig || defaultConfig);
     const [saving, setSaving] = useState(false);
     const [errorMsg, setErrorMsg] = useState<string | null>(null);

     const handleChange = useCallback((field: keyof WhatsAppConfig, value: string) => {
          setConfig(prev => ({ ...prev, [field]: value }));
          setErrorMsg(null);
     }, []);

     const handleSave = useCallback(async () => {
          setSaving(true);
          setErrorMsg(null);
          try {
               await adminService.updateWhatsAppConfig({
                    phone_number_id: config.phoneNumberId,
                    business_account_id: config.businessAccountId,
                    access_token: config.accessToken,
                    api_version: config.apiVersion,
               });
               onSave(config);
               onClose();
          } catch (error) {
               setErrorMsg(error instanceof Error ? error.message : "Kaydetme ba\u015Far\u0131s\u0131z");
          } finally {
               setSaving(false);
          }
     }, [config, onSave, onClose]);

     useEffect(() => {
          if (!isOpen) return;
          const prevFocus = document.activeElement as HTMLElement;
          const focusable = modalRef.current?.querySelectorAll(
               'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const first = focusable?.[0] as HTMLElement;
          setTimeout(() => first?.focus(), 0);
          const handleKeyDown = (e: KeyboardEvent) => {
               if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
               if (e.key !== "Tab" || !focusable?.length) return;
               const last = focusable[focusable.length - 1] as HTMLElement;
               if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
               else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          };
          document.addEventListener("keydown", handleKeyDown);
          return () => { document.removeEventListener("keydown", handleKeyDown); prevFocus?.focus(); };
     }, [isOpen, onClose]);

     if (!isOpen) return null;

     return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: Z_INDEX.modal, padding: 24 }}
               onClick={onClose} role="presentation" aria-hidden="true"
          >
               <Card ref={modalRef} style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto" }}
                    onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="config-modal-title"
               >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
                         <div>
                              <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>WhatsApp Business API</h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>Facebook (Meta) Cloud API yap\u0131land\u0131rmas\u0131</p>
                         </div>
                         <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: RADIUS.md, color: COLORS.muted }}>
                              <X size={20} />
                         </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Telefon Numaras\u0131 ID <span style={{ color: COLORS.danger }}>*</span></label>
                              <input type="text" value={config.phoneNumberId} onChange={(e) => handleChange("phoneNumberId", e.target.value)} placeholder="\u00D6rn: 105938XXXX" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>\u0130\u015Fletme Hesab\u0131 ID <span style={{ color: COLORS.danger }}>*</span></label>
                              <input type="text" value={config.businessAccountId} onChange={(e) => handleChange("businessAccountId", e.target.value)} placeholder="\u00D6rn: 104998XXXX" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Ge\u00E7ici/Kal\u0131c\u0131 Eri\u015Fim Tokeni <span style={{ color: COLORS.danger }}>*</span></label>
                              <textarea value={config.accessToken} onChange={(e) => handleChange("accessToken", e.target.value)} placeholder="EAAGm0..." rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, resize: "vertical" }} />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>API Versiyonu</label>
                              <input type="text" value={config.apiVersion} onChange={(e) => handleChange("apiVersion", e.target.value)} placeholder="v17.0" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         {errorMsg && (
                              <div style={{ padding: 12, borderRadius: RADIUS.md, background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}30`, fontSize: 13, fontWeight: 500, color: COLORS.danger }}>
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>\u0130ptal</Button>
                              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !config.phoneNumberId || !config.businessAccountId || !config.accessToken}>
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
