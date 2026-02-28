import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
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
               setErrorMsg(error instanceof Error ? error.message : "Kaydetme başarısız");
          } finally {
               setSaving(false);
          }
     }, [config, onSave, onClose]);

     if (!isOpen) return null;

     return (
          <div
               style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                    padding: 24,
               }}
               onClick={onClose}
          >
               <Card
                    style={{
                         width: "100%",
                         maxWidth: 480,
                         maxHeight: "90vh",
                         overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
               >
                    <div
                         style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 20,
                              paddingBottom: 16,
                              borderBottom: `1px solid ${COLORS.border}`,
                         }}
                    >
                         <div>
                              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                                   WhatsApp Business API
                              </h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                                   Facebook (Meta) Cloud API yapılandırması
                              </p>
                         </div>
                         <button
                              onClick={onClose}
                              style={{
                                   background: "none",
                                   border: "none",
                                   cursor: "pointer",
                                   padding: 8,
                                   borderRadius: RADIUS.md,
                                   color: COLORS.muted,
                              }}
                         >
                              <X size={20} />
                         </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                         {/* Phone Number ID */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Telefon Numarası ID <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.phoneNumberId}
                                   onChange={(e) => handleChange("phoneNumberId", e.target.value)}
                                   placeholder="Örn: 105938XXXX"
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                   }}
                              />
                         </div>

                         {/* Business Account ID */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   İşletme Hesabı ID <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.businessAccountId}
                                   onChange={(e) => handleChange("businessAccountId", e.target.value)}
                                   placeholder="Örn: 104998XXXX"
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                   }}
                              />
                         </div>

                         {/* Access Token */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Geçici/Kalıcı Erişim Tokeni <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <textarea
                                   value={config.accessToken}
                                   onChange={(e) => handleChange("accessToken", e.target.value)}
                                   placeholder="EAAGm0..."
                                   rows={3}
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                        resize: "vertical",
                                   }}
                              />
                         </div>

                         {/* API Version */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   API Versiyonu
                              </label>
                              <input
                                   type="text"
                                   value={config.apiVersion}
                                   onChange={(e) => handleChange("apiVersion", e.target.value)}
                                   placeholder="v17.0"
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                   }}
                              />
                         </div>

                         {errorMsg && (
                              <div
                                   style={{
                                        padding: 12,
                                        borderRadius: RADIUS.md,
                                        background: `${COLORS.error.DEFAULT}15`,
                                        border: `1px solid ${COLORS.error.DEFAULT}30`,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: COLORS.error.DEFAULT,
                                   }}
                              >
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                                   İptal
                              </Button>
                              <Button
                                   variant="primary"
                                   size="sm"
                                   onClick={handleSave}
                                   disabled={saving || !config.phoneNumberId || !config.businessAccountId || !config.accessToken}
                              >
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
