import { useCallback, useEffect, useState } from "react";
import { Building, Globe, Mail, Phone, RefreshCw, Save } from "lucide-react";
import { TopBar } from "../Layout";
import { Button, Card, Input } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import { useToast } from "../../contexts/ToastContext";
import type { OrganizationConfig } from "../../services/adminService";

export function OrganizationPage() {
  const [orgConfig, setOrgConfig] = useState<OrganizationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminService.getOrganizationConfig();
      setOrgConfig(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Organizasyon bilgileri yuklenemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!orgConfig?.companyName?.trim()) nextErrors.company_name = "Sirket adi zorunludur";
    if (orgConfig?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgConfig.email)) {
      nextErrors.email = "Gecerli bir e-posta giriniz";
    }
    if (orgConfig?.website && !/^https?:\/\//.test(orgConfig.website)) {
      nextErrors.website = "URL https:// ile baslamalidir";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !orgConfig) return;
    setSaving(true);
    try {
      await adminService.updateOrganizationConfig(orgConfig);
      addToast("Organizasyon bilgileri kaydedildi", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kaydedilemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="electric-page">
        <TopBar title="Organizasyon" subtitle="Sirket profili" />
        <div className="app-page-container">
          <Card title="Yukleniyor...">
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Bilgiler getiriliyor...</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="electric-page">
      <TopBar title="Organizasyon" subtitle="Sirket profili ve temel bilgiler" />

      <div className="app-page-container">
        <div style={{ maxWidth: 800 }}>
          <Card
            title="Sirket Bilgileri"
            actions={
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={loadOrganization} disabled={loading}>
                  <RefreshCw size={16} /> Yenile
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={16} /> Kaydet
                </Button>
              </div>
            }
            style={{ marginBottom: 20 }}
          >
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle}>
                  <Building size={16} />
                  Sirket Adi *
                </label>
                <Input
                  value={orgConfig?.companyName || ""}
                  onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, companyName: e.target.value } : null))}
                  placeholder="Sirket adi"
                />
                {errors.company_name && <div style={errorTextStyle}>{errors.company_name}</div>}
              </div>

              <div>
                <label style={fieldLabelStyle}>
                  <Mail size={16} />
                  E-posta
                </label>
                <Input
                  type="email"
                  value={orgConfig?.email || ""}
                  onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, email: e.target.value } : null))}
                  placeholder="info@example.com"
                />
                {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
              </div>

              <div>
                <label style={fieldLabelStyle}>
                  <Phone size={16} />
                  Telefon
                </label>
                <Input
                  value={orgConfig?.phone || ""}
                  onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
                  placeholder="+90 (555) 123 45 67"
                />
              </div>

              <div>
                <label style={fieldLabelStyle}>
                  <Globe size={16} />
                  Web Sitesi
                </label>
                <Input
                  value={orgConfig?.website || ""}
                  onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, website: e.target.value } : null))}
                  placeholder="https://www.example.com"
                />
                {errors.website && <div style={errorTextStyle}>{errors.website}</div>}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6, display: "block" }}>
                  Adres
                </label>
                <textarea
                  value={orgConfig?.address || ""}
                  onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, address: e.target.value } : null))}
                  placeholder="Tam adres"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.md,
                    fontSize: 14,
                    fontFamily: TYPOGRAPHY.fontFamily.base,
                    background: COLORS.panel,
                    color: COLORS.text,
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </Card>

          <Card title="Vergi Bilgileri" style={{ marginBottom: 20 }}>
            <div style={{ padding: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6, display: "block" }}>
                Vergi Kimlik Numarasi (VKN)
              </label>
              <Input
                value={orgConfig?.taxId || ""}
                onChange={(e) => setOrgConfig((prev) => (prev ? { ...prev, taxId: e.target.value } : null))}
                placeholder="12345678901"
              />
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={loadOrganization} disabled={loading}>
              Iptal
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Degisiklikleri Kaydet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.text,
  marginBottom: 6,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: COLORS.error.DEFAULT,
  marginTop: 4,
};
