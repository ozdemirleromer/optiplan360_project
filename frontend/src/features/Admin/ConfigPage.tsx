/**
 * Config Page - System configuration & theme selector
 */

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "../../components/Layout";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX, primaryRgba } from "../../components/Shared/constants";
import { THEME_LIST } from "../../themes";
import { useUIStore } from "../../stores/uiStore";
import { useToast } from "../../contexts/ToastContext";
import { adminService, type SystemConfig, type SystemControlCheck, type SystemControlRow } from "../../services/adminService";
import { optiplanWorkflowService, type FolderSettings } from "../../services/optiplanWorkflowService";
import { Check, Shield, Plug, Loader2, Folder } from "lucide-react";

type FeatureFlag = {
  name: string;
  enabled: boolean;
  updated_at?: string | null;
  updatedAt?: string | null;
};

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  ai_orchestrator: { label: "AI Orkestratör", description: "Yapay zeka tabanlı iş akışı optimizasyonu" },
  whatsapp_integration: { label: "WhatsApp Entegrasyonu", description: "WhatsApp üzerinden müşteri bildirimleri" },
  mikro_integration: { label: "Mikro ERP", description: "Mikro muhasebe yazılımı ile MsSQL entegrasyonu" },
  ocr_enabled: { label: "OCR Motoru", description: "Optik karakter tanıma ile sipariş okuma" },
  compliance_checks: { label: "Uyumluluk Kontrolleri", description: "Otomatik kalite ve uyumluluk denetimi" },
  advanced_analytics: { label: "Gelişmiş Analitik", description: "AI destekli tahmin ve kapasite planlaması" },
  beta_features: { label: "Beta Özellikler", description: "Deneysel özellikler (kararsız olabilir)" },
};

export function ConfigPage() {
  const DEFAULT_PROGRAM_ROOT = "C:/Optiplan360_Entegrasyon";

  const [activeSection, setActiveSection] = useState<"theme" | "system" | "folders" | "services">("theme");
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<"all" | "active" | "inactive">("all");
  const [serviceQuery, setServiceQuery] = useState("");
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [systemConfigLoading, setSystemConfigLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState<SystemControlCheck | null>(null);
  const [systemCheckLoading, setSystemCheckLoading] = useState(false);
  const [systemCheckError, setSystemCheckError] = useState<string | null>(null);
  const [systemConfigDraft, setSystemConfigDraft] = useState<string | null>(null);
  const [folderSettings, setFolderSettings] = useState<FolderSettings | null>(null);
  const [folderDraftSnapshot, setFolderDraftSnapshot] = useState<string | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderPickerSupported, setFolderPickerSupported] = useState(false);
  const [folderErrors, setFolderErrors] = useState<Partial<Record<FolderFieldKey, string>>>({});
  const [suggestedFolderPreview, setSuggestedFolderPreview] = useState<Partial<Record<FolderFieldKey, string>> | null>(null);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [folderBrowserPath, setFolderBrowserPath] = useState("C:/");
  const [folderBrowserDirs, setFolderBrowserDirs] = useState<Array<{ name: string; path: string }>>([]);
  const [folderBrowserParent, setFolderBrowserParent] = useState<string | null>(null);
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false);
  const [folderBrowserCallback, setFolderBrowserCallback] = useState<((path: string) => void) | null>(null);

  const currentTheme = useUIStore((s) => s.themeName);
  const setThemeName = useUIStore((s) => s.setThemeName);
  const { addToast } = useToast();

  type FolderFieldKey =
    | "whatsappRawKlasoru"
    | "scannerRawKlasoru"
    | "manuelRawKlasoru"
    | "emailRawKlasoru"
    | "islenmisKlasoru"
    | "arsivKlasoru"
    | "xmlOkumaKlasoru"
    | "xlsxCiktiKlasoru"
    | "opjCiktiKlasoru"
    | "hataliKlasoru";

  const folderFieldDefinitions: Array<{ key: FolderFieldKey; label: string }> = [
    { key: "whatsappRawKlasoru", label: "Whatsapp Raw Klasoru" },
    { key: "scannerRawKlasoru", label: "Scanner Raw Klasoru" },
    { key: "manuelRawKlasoru", label: "Manuel Yukleme Yolu" },
    { key: "emailRawKlasoru", label: "Email Raw Klasoru" },
    { key: "islenmisKlasoru", label: "Islenmis Klasoru" },
    { key: "arsivKlasoru", label: "Arsiv Klasoru" },
    { key: "xmlOkumaKlasoru", label: "XML Okuma Klasoru" },
    { key: "xlsxCiktiKlasoru", label: "XLSX Cikti Klasoru" },
    { key: "opjCiktiKlasoru", label: "OPJ Cikti Klasoru" },
    { key: "hataliKlasoru", label: "Hatali Klasoru" },
  ];

  const normalizeFolderPath = (value: string) => value.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  const joinPath = (root: string, ...parts: string[]) => {
    const normalizedRoot = root.trim().replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedParts = parts.map((part) => part.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")).filter(Boolean);
    return [normalizedRoot, ...normalizedParts].join("/");
  };

  const buildSuggestedFolderPaths = (root: string): Record<FolderFieldKey, string> => ({
    whatsappRawKlasoru: joinPath(root, "HAM_GORSELLER", "whatsapp_raw"),
    scannerRawKlasoru: joinPath(root, "HAM_GORSELLER", "scanner_raw"),
    manuelRawKlasoru: joinPath(root, "HAM_GORSELLER", "manuel_raw"),
    emailRawKlasoru: joinPath(root, "HAM_GORSELLER", "email_raw"),
    islenmisKlasoru: joinPath(root, "HAM_GORSELLER", "_islenmis"),
    arsivKlasoru: joinPath(root, "HAM_GORSELLER", "_arsiv"),
    xmlOkumaKlasoru: joinPath(root, "XmlJob"),
    xlsxCiktiKlasoru: joinPath(root, "EXPORT", "excel"),
    opjCiktiKlasoru: joinPath(root, "OptiPlanning", "Export"),
    hataliKlasoru: joinPath(root, "OPTİPLAN", "3_HATALI_VERILER"),
  });

  const validateFolderSettings = (draft: FolderSettings): Partial<Record<FolderFieldKey, string>> => {
    const errors: Partial<Record<FolderFieldKey, string>> = {};
    const usedPaths = new Set<string>();

    folderFieldDefinitions.forEach(({ key }) => {
      const raw = draft[key].trim();
      if (!raw) {
        errors[key] = "Klasor yolu zorunludur.";
        return;
      }

      const normalized = normalizeFolderPath(raw);
      if (!/^(?:[a-zA-Z]:\/|\/)/.test(raw.replace(/\\/g, "/"))) {
        errors[key] = "Gecerli bir mutlak klasor yolu giriniz.";
        return;
      }

      if (usedPaths.has(normalized)) {
        errors[key] = "Bu klasor yolu baska bir alanla ayni olamaz.";
        return;
      }

      usedPaths.add(normalized);
    });

    return errors;
  };

  const loadFeatures = useCallback(async () => {
    setFeaturesLoading(true);
    setFeatureError(null);
    try {
      const data = await adminService.getFeatureFlags();
      setFeatures(data.features ?? []);
    } catch (err) {
      setFeatures([]);
      const message = err instanceof Error ? err.message : "Servis bilgisi alinamadi";
      setFeatureError(message);
    } finally {
      setFeaturesLoading(false);
    }
  }, []);

  const getFeatureUpdatedAt = (flag: FeatureFlag) => {
    const raw = flag.updatedAt ?? flag.updated_at;
    if (!raw) return "Henuz guncelleme kaydi yok";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Guncelleme tarihi bilinmiyor";
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(date);
  };

  const loadSystemConfig = useCallback(async () => {
    setSystemConfigLoading(true);
    try {
      const data = await adminService.getSystemConfig();
      setSystemConfig(data);
      setSystemConfigDraft(JSON.stringify(data));
    } catch {
      setSystemConfig(null);
      addToast("Sistem ayarlari alinamadi", "error");
    } finally {
      setSystemConfigLoading(false);
    }
  }, [addToast]);

  const runSystemCheck = useCallback(async () => {
    setSystemCheckLoading(true);
    setSystemCheckError(null);
    try {
      const data = await adminService.runSystemControlCheck();
      setSystemCheck(data);
    } catch (err) {
      setSystemCheck(null);
      const message = err instanceof Error ? err.message : "Denetim kontrolu calistirilamadi";
      setSystemCheckError(message);
    } finally {
      setSystemCheckLoading(false);
    }
  }, []);

  const loadFolderSettings = useCallback(async () => {
    setFolderLoading(true);
    try {
      const data = await optiplanWorkflowService.getFolderSettings();
      setFolderSettings(data);
      setFolderDraftSnapshot(JSON.stringify(data));
      setFolderErrors({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Klasor ayarlari alinamadi";
      addToast(message, "error");
      setFolderSettings(null);
    } finally {
      setFolderLoading(false);
    }
  }, [addToast]);

  const getSystemStatusColor = (status: SystemControlRow["status"]) => {
    if (status === "ok") return COLORS.success;
    if (status === "warn") return COLORS.warning;
    if (status === "critical") return COLORS.danger;
    return COLORS.muted;
  };

  const systemControlGroups = systemCheck?.rows?.reduce<Record<string, SystemControlRow[]>>((acc, row) => {
    const key = row.module || "Genel";
    acc[key] = acc[key] ? [...acc[key], row] : [row];
    return acc;
  }, {}) ?? null;

  useEffect(() => {
    if (activeSection === "services") {
      void loadFeatures();
    }
    if (activeSection === "system" && !systemConfig) {
      void loadSystemConfig();
    }
    if (activeSection === "system" && !systemCheck) {
      void runSystemCheck();
    }
    if (activeSection === "folders" && !folderSettings) {
      void loadFolderSettings();
      setFolderPickerSupported(true);
    }
  }, [activeSection, folderSettings, loadFeatures, loadFolderSettings, loadSystemConfig, runSystemCheck, systemCheck, systemConfig]);

  const handleToggleFeature = async (flag: FeatureFlag) => {
    setTogglingFlag(flag.name);
    try {
      await adminService.updateFeatureFlag(flag.name, !flag.enabled);
      setFeatures((prev) =>
        prev.map((f) => (f.name === flag.name ? { ...f, enabled: !f.enabled } : f))
      );
      const info = FEATURE_LABELS[flag.name];
      addToast(`${info?.label ?? flag.name} ${!flag.enabled ? "etkinleştirildi" : "devre dışı bırakıldı"}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "İşlem başarısız";
      addToast(msg, "error");
    } finally {
      setTogglingFlag(null);
    }
  };

  const controlMatrix = [
    {
      category: "Sipariş Yönetimi",
      items: [
        { id: 1, scenario: "Yeni sipariş oluşturulur", action: "Tekil kontrol" },
        { id: 2, scenario: "Sipariş güncellenir", action: "Versiyon kontrol" },
        { id: 3, scenario: "Sipariş silinir", action: "Geçici silme" },
        { id: 4, scenario: "Toplu sipariş eklenir", action: "İşlem bütünlüğü kontrolü" },
      ]
    },
    {
      category: "İstasyon Yönetimi",
      items: [
        { id: 5, scenario: "İstasyon oluşturulur", action: "İsim tekil kontrolü" },
        { id: 6, scenario: "İstasyon kaldırılır", action: "Alt bağımlılıklar kontrol" },
        { id: 7, scenario: "İş akışı değiştirilir", action: "Aktif sipariş kontrol" },
      ]
    },
    {
      category: "Kullanıcı Yönetimi",
      items: [
        { id: 8, scenario: "Kullanıcı oluşturulur", action: "E-posta tekil kontrolü" },
        { id: 9, scenario: "Şifre değiştirilir", action: "Güçlü şifre kontrol" },
        { id: 10, scenario: "Hesap silinir", action: "30 gün saklama" },
      ]
    },
    {
      category: "Sistem Güvenliği",
      items: [
        { id: 11, scenario: "API istek sınırı aşılır", action: "429 döndür" },
        { id: 12, scenario: "Geçersiz token", action: "401 döndür" },
        { id: 13, scenario: "SQL enjeksiyon denemesi", action: "IP banla" },
      ]
    },
  ];

  const handleSave = async () => {
    if (!systemConfig) {
      addToast("Kaydedilecek sistem ayari bulunamadi", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await adminService.updateSystemConfig({
        shiftStart: systemConfig.shiftStart,
        shiftEnd: systemConfig.shiftEnd,
        sessionTimeoutMinutes: systemConfig.sessionTimeoutMinutes,
        backupFrequency: systemConfig.backupFrequency,
        logRetentionDays: systemConfig.logRetentionDays,
        enableTwoFactor: systemConfig.enableTwoFactor,
      });
      setSystemConfig((prev) => (prev ? { ...prev, ...updated } : updated));
      setSystemConfigDraft(JSON.stringify(updated));
      addToast("Sistem ayarları kaydedildi", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ayarlar kaydedilemedi";
      addToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSystemConfig = () => {
    if (!systemConfigDraft) return;
    try {
      setSystemConfig(JSON.parse(systemConfigDraft) as SystemConfig);
      addToast("Sistem ayari degisiklikleri geri alindi", "success");
    } catch {
      addToast("Kayitli sistem ayarlari geri yuklenemedi", "error");
    }
  };

  const updateSystemField = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setSystemConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateFolderField = <K extends FolderFieldKey>(key: K, value: string) => {
    setFolderSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFolderErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSaveFolderSettings = async () => {
    if (!folderSettings) {
      addToast("Kaydedilecek klasor ayari bulunamadi", "error");
      return;
    }

    const errors = validateFolderSettings(folderSettings);
    if (Object.keys(errors).length > 0) {
      setFolderErrors(errors);
      addToast("Klasor ayarlarinda hatali alanlar var", "error");
      return;
    }

    setFolderSaving(true);
    try {
      const updated = await optiplanWorkflowService.updateFolderSettings(folderSettings);
      setFolderSettings(updated);
      setFolderDraftSnapshot(JSON.stringify(updated));
      setFolderErrors({});
      addToast("Klasor ayarlari kaydedildi", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Klasor ayarlari kaydedilemedi";
      addToast(message, "error");
    } finally {
      setFolderSaving(false);
    }
  };

  const handleResetFolderSettings = () => {
    if (!folderDraftSnapshot) return;
    try {
      setFolderSettings(JSON.parse(folderDraftSnapshot) as FolderSettings);
      setFolderErrors({});
      addToast("Klasor ayari degisiklikleri geri alindi", "success");
    } catch {
      addToast("Klasor ayarlari geri yuklenemedi", "error");
    }
  };

  const applySuggestedFolderPaths = () => {
    if (!folderSettings) {
      addToast("Klasor ayarlari yuklenmeden yol onerisi uygulanamaz", "error");
      return;
    }

    const root = (folderSettings.programKokKlasoru || "").trim();
    if (!root) {
      addToast("Program kok klasoru bos olamaz", "error");
      return;
    }

    const suggestedPaths = buildSuggestedFolderPaths(root);

    const updatedSettings: FolderSettings = {
      ...folderSettings,
      programKokKlasoru: root,
      ...folderFieldDefinitions.reduce((acc, { key }) => {
        acc[key] = suggestedPaths[key];
        return acc;
      }, {} as Partial<FolderSettings>),
    };

    const errors = validateFolderSettings(updatedSettings);
    setFolderErrors(errors);
    setFolderSettings(updatedSettings);
    setSuggestedFolderPreview(
      folderFieldDefinitions.reduce((acc, { key }) => {
        acc[key] = suggestedPaths[key];
        return acc;
      }, {} as Partial<Record<FolderFieldKey, string>>),
    );

    const allCount = folderFieldDefinitions.length;
    addToast(`${allCount} klasor alani icin onerilen yol uygulandi`, "success");
  };

  const applyDefaultProgramRoot = () => {
    setFolderSettings((prev) => (prev ? { ...prev, programKokKlasoru: DEFAULT_PROGRAM_ROOT } : prev));
    addToast("Program kok klasoru varsayilan degerle guncellendi", "success");
  };

  const previewSuggestedFolderPaths = () => {
    if (!folderSettings) {
      addToast("Klasor ayarlari yuklenmeden onizleme olusturulamaz", "error");
      return;
    }

    const root = (folderSettings.programKokKlasoru || "").trim();
    if (!root) {
      addToast("Program kok klasoru bos olamaz", "error");
      return;
    }

    const suggestedPaths = buildSuggestedFolderPaths(root);
    const selectedPreview = folderFieldDefinitions.reduce((acc, { key }) => {
      acc[key] = suggestedPaths[key];
      return acc;
    }, {} as Partial<Record<FolderFieldKey, string>>);

    setSuggestedFolderPreview(selectedPreview);
    const allCount = Object.keys(selectedPreview).length;
    addToast(`${allCount} klasor alani icin onizleme olusturuldu`, "success");
  };

  const loadBrowserDirectories = useCallback(async (dirPath: string) => {
    setFolderBrowserLoading(true);
    try {
      const res = await adminService.listDirectories(dirPath);
      setFolderBrowserPath(res.path);
      setFolderBrowserDirs(res.directories);
      setFolderBrowserParent(res.parent ?? null);
      if (res.error) addToast(res.error, "warning");
    } catch {
      addToast("Dizin listesi alinamadi", "warning");
    } finally {
      setFolderBrowserLoading(false);
    }
  }, [addToast]);

  const openFolderBrowser = (currentValue: string, onSelected: (path: string) => void) => {
    const initial = currentValue || "C:/";
    setFolderBrowserCallback(() => onSelected);
    setFolderBrowserOpen(true);
    void loadBrowserDirectories(initial);
  };

  const confirmFolderSelection = () => {
    if (folderBrowserCallback) folderBrowserCallback(folderBrowserPath);
    setFolderBrowserOpen(false);
    setFolderBrowserCallback(null);
  };

  const hasSystemConfigChanges = systemConfig ? JSON.stringify(systemConfig) !== systemConfigDraft : false;
  const hasFolderSettingsChanges = folderSettings ? JSON.stringify(folderSettings) !== folderDraftSnapshot : false;
  const normalizedServiceQuery = serviceQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredFeatures = features.filter((flag) => {
    const info = FEATURE_LABELS[flag.name] ?? { label: flag.name, description: "" };
    const matchesFilter = serviceFilter === "all" ? true : serviceFilter === "active" ? flag.enabled : !flag.enabled;
    const searchText = `${info.label} ${info.description} ${flag.name}`.toLocaleLowerCase("tr-TR");
    return matchesFilter && (!normalizedServiceQuery || searchText.includes(normalizedServiceQuery));
  });

  const formatCheckedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Bilinmiyor";
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(date);
  };

  return (
    <div className="electric-page">
      <TopBar title="Sistem Ayarları" subtitle="Konfigürasyon ve denetim matrisi" />

      <div className="app-page-container">
        {/* Section Tabs */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {([
            { key: "theme" as const, label: "Tema Ayarları", icon: undefined },
            { key: "system" as const, label: "Sistem Kontrolü", icon: undefined },
            { key: "folders" as const, label: "Klasor Yonetimi", icon: <Folder size={14} /> },
            { key: "services" as const, label: "Servisler", icon: <Plug size={14} /> },
          ]).map(({ key, label, icon }) => (
            <button type="button"
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: activeSection === key ? 700 : 400,
                color: activeSection === key ? COLORS.primary : COLORS.muted,
                background: activeSection === key ? `${COLORS.primary}08` : "transparent",
                border: "none",
                borderBottom: activeSection === key ? `3px solid ${COLORS.primary}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {activeSection === "theme" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {THEME_LIST.map((theme) => {
              const isActive = currentTheme === theme.name;
              return (
                <div
                  key={theme.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setThemeName(theme.name);
                    addToast(`Tema "${theme.label}" uygulandi`, "success");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setThemeName(theme.name);
                      addToast(`Tema "${theme.label}" uygulandi`, "success");
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    borderRadius: RADIUS.md,
                    overflow: "hidden",
                    outline: "none",
                    transition: "all 0.18s ease",
                    transform: isActive ? "translateY(-2px)" : "none",
                    boxShadow: isActive
                      ? `0 6px 20px ${primaryRgba(0.35)}, 0 0 0 2px ${COLORS.primary}`
                      : `0 2px 8px ${primaryRgba(0.14)}`,
                  }}
                >
                  {/* Üst şerit — tema ana rengiyle dolu */}
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.accent})`,
                      padding: "14px 14px 12px",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.panel, letterSpacing: "0.01em" }}>
                        {theme.label}
                      </span>
                      {isActive && (
                        <Check size={15} color={COLORS.panel} strokeWidth={3} />
                      )}
                    </div>
                    {/* Renk nokta önizleme */}
                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.bg, border: "1.5px solid rgba(255,255,255,0.4)" }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.panel, opacity: 0.7 }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.accent, border: "1.5px solid rgba(255,255,255,0.4)" }} />
                    </div>
                  </div>
                  {/* Alt açıklama */}
                  <div
                    style={{
                      background: isActive ? primaryRgba(0.10) : COLORS.bg.elevated,
                      padding: "8px 12px 10px",
                      borderTop: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.45 }}>
                      Tema profili: {theme.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* System Control Matrix */}
        {activeSection === "system" && (
          <>
            <Card
              title="Temel Sistem Ayarlari"
              subtitle="Canli sistem konfigurasyonundan gelen temel alanlari duzenleyin"
              actions={
                <Button variant="secondary" size="sm" onClick={() => void loadSystemConfig()} disabled={systemConfigLoading}>
                  {systemConfigLoading ? "Yukleniyor..." : "Yenile"}
                </Button>
              }
            >
              {systemConfigLoading && !systemConfig ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24, color: COLORS.muted }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ marginLeft: 8 }}>Sistem ayarlari yukleniyor...</span>
                </div>
              ) : systemConfig ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Vardiya Baslangici
                    <input
                      value={systemConfig.shiftStart}
                      onChange={(event) => updateSystemField("shiftStart", event.target.value)}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Vardiya Bitisi
                    <input
                      value={systemConfig.shiftEnd}
                      onChange={(event) => updateSystemField("shiftEnd", event.target.value)}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Oturum Zaman Asimi (dk)
                    <input
                      type="number"
                      value={systemConfig.sessionTimeoutMinutes}
                      onChange={(event) => updateSystemField("sessionTimeoutMinutes", Number(event.target.value))}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Log Saklama (gun)
                    <input
                      type="number"
                      value={systemConfig.logRetentionDays}
                      onChange={(event) => updateSystemField("logRetentionDays", Number(event.target.value))}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Yedekleme Sikligi
                    <input
                      value={systemConfig.backupFrequency}
                      onChange={(event) => updateSystemField("backupFrequency", event.target.value)}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: COLORS.text, paddingTop: 22 }}>
                    <input
                      type="checkbox"
                      checked={systemConfig.enableTwoFactor}
                      onChange={(event) => updateSystemField("enableTwoFactor", event.target.checked)}
                    />
                    Iki faktorlu dogrulama aktif
                  </label>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 24, color: COLORS.muted, fontSize: 13 }}>
                  Sistem ayarlari alinamadi. Baglantiyi kontrol edip yeniden deneyin.
                </div>
              )}
            </Card>

            <Card
              title="Denetim Matrisi"
              subtitle="Sistem işlemleri için kontrol senaryoları"
              actions={
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => void runSystemCheck()} disabled={systemCheckLoading}>
                    {systemCheckLoading ? "Kontrol Calisiyor..." : "Kontrolu Yenile"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleResetSystemConfig} disabled={saving || !hasSystemConfigChanges}>
                    Degisiklikleri Geri Al
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !systemConfig || !hasSystemConfigChanges}>
                    {saving ? "Kaydediliyor..." : hasSystemConfigChanges ? "Degisiklikleri Kaydet" : "Kaydet"}
                  </Button>
                </div>
              }
            >
              <div style={{ display: "grid", gap: "16px" }}>
                {systemConfig && hasSystemConfigChanges ? (
                  <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: COLORS.warning, fontSize: 12, fontWeight: 600 }}>
                    Kaydedilmemis sistem ayari degisiklikleri var.
                  </div>
                ) : null}
                {systemCheck ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.md, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}` }}>
                      <div>
                        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Son kontrol</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{formatCheckedAt(systemCheck.checkedAt)}</div>
                      </div>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>
                          <span>Kapsama</span>
                          <span>%{systemCheck.coverage}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: COLORS.bg.main, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                          <div style={{ width: `${systemCheck.coverage}%`, height: "100%", background: COLORS.primary }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: RADIUS.md, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}` }}><div style={{ fontSize: 11, color: COLORS.muted }}>Toplam</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{systemCheck.total}</div></div>
                      <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}><div style={{ fontSize: 11, color: COLORS.muted }}>OK</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.success }}>{systemCheck.ok}</div></div>
                      <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}><div style={{ fontSize: 11, color: COLORS.muted }}>Warn</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.warning }}>{systemCheck.warn}</div></div>
                      <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(107,114,128,0.08)", border: `1px solid ${COLORS.border}` }}><div style={{ fontSize: 11, color: COLORS.muted }}>Missing</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.muted }}>{systemCheck.missing}</div></div>
                      <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}><div style={{ fontSize: 11, color: COLORS.muted }}>Critical</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.danger }}>{systemCheck.critical}</div></div>
                    </div>
                  </>
                ) : null}
                {systemCheckError ? (
                  <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: COLORS.danger, fontSize: 12 }}>
                    {systemCheckError}
                  </div>
                ) : null}
                {systemControlGroups ? (
                  Object.entries(systemControlGroups).map(([groupName, rows]) => (
                    <div
                      key={groupName}
                      style={{
                        padding: "16px",
                        background: COLORS.bg.surface,
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.border}`
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Shield size={16} color={COLORS.primary} />
                        {groupName}
                      </div>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {rows.map((row) => (
                          <div
                            key={row.id}
                            style={{
                              padding: "10px",
                              background: COLORS.bg.main,
                              borderRadius: RADIUS.sm,
                              border: `1px solid ${COLORS.border}`
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{row.control}</div>
                                <div style={{ fontSize: 11, color: COLORS.muted }}>Beklenen: {row.expected} | Guncel: {row.current}</div>
                                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Ort: {row.env} | Sorumlu: {row.owner}</div>
                              </div>
                              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: RADIUS.sm, background: `${getSystemStatusColor(row.status)}22`, color: getSystemStatusColor(row.status), fontWeight: 700, textTransform: "uppercase" }}>
                                {row.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  controlMatrix.map((group) => (
                    <div
                      key={group.category}
                      style={{
                        padding: "16px",
                        background: COLORS.bg.surface,
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.border}`
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Shield size={16} color={COLORS.primary} />
                        {group.category}
                      </div>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {group.items.map((item) => (
                          <div key={item.id} style={{ padding: "10px", background: COLORS.bg.main, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", fontSize: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: "2px" }}>{item.scenario}</div>
                              <div style={{ fontSize: 11, color: COLORS.muted }}>Aksiyon: {item.action}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: COLORS.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="white" /></div>
                              <span style={{ marginLeft: "8px", color: COLORS.muted }}>Aktif</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}

        {activeSection === "folders" && (
          <Card
            title="Klasor Yonetimi"
            subtitle="OptiPlan Workflow klasor ayarlarini merkezi olarak yonetin"
            actions={
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => void loadFolderSettings()} disabled={folderLoading || folderSaving}>
                  {folderLoading ? "Yukleniyor..." : "Yenile"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleResetFolderSettings} disabled={folderSaving || !hasFolderSettingsChanges}>
                  Degisiklikleri Geri Al
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveFolderSettings} disabled={folderLoading || folderSaving || !folderSettings || !hasFolderSettingsChanges}>
                  {folderSaving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            }
          >
            {folderLoading && !folderSettings ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24, color: COLORS.muted }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ marginLeft: 8 }}>Klasor ayarlari yukleniyor...</span>
              </div>
            ) : folderSettings ? (
              <div style={{ display: "grid", gap: 16 }}>
                {hasFolderSettingsChanges ? (
                  <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: COLORS.warning, fontSize: 12, fontWeight: 600 }}>
                    Kaydedilmemis klasor ayari degisiklikleri var.
                  </div>
                ) : null}

                <div style={{ padding: 12, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 600 }}>Program Kok Klasoru</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button type="button" variant="secondary" size="sm" onClick={applyDefaultProgramRoot} disabled={!folderSettings || folderLoading || folderSaving}>
                        Varsayilana Don
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={previewSuggestedFolderPaths} disabled={!folderSettings || folderLoading || folderSaving}>
                        Onerilenleri Onizle
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={applySuggestedFolderPaths} disabled={!folderSettings || folderLoading || folderSaving}>
                        Onerilen Yollari Uygula
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                    <input
                      value={folderSettings.programKokKlasoru}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, programKokKlasoru: event.target.value } : prev))}
                      placeholder="C:/Optiplan360_Entegrasyon"
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: RADIUS.sm,
                        border: `1px solid ${COLORS.border}`,
                        background: COLORS.bg.surface,
                        color: COLORS.text,
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      title="Klasör seç"
                      disabled={folderLoading || folderSaving || !folderPickerSupported}
                      onClick={() => openFolderBrowser(
                        folderSettings.programKokKlasoru,
                        (path) => setFolderSettings((prev) => (prev ? { ...prev, programKokKlasoru: path } : prev)),
                      )}
                    >
                      <Folder size={16} />
                    </Button>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    Tum klasor satirlari program kok klasorune gore otomatik doldurulur.
                  </div>
                </div>

                {suggestedFolderPreview && Object.keys(suggestedFolderPreview).length > 0 ? (
                  <div style={{ padding: 12, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 600 }}>Onerilen Yol Onizlemesi</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {folderFieldDefinitions
                        .filter(({ key }) => Boolean(suggestedFolderPreview[key]))
                        .map(({ key, label }) => (
                          <div key={`preview-${key}`} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: COLORS.muted }}>{label}</span>
                            <span style={{ fontSize: 12, color: COLORS.text }}>{suggestedFolderPreview[key]}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.md,
                    overflow: "hidden",
                    background: COLORS.bg.surface,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px minmax(220px, 320px) 1fr",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: COLORS.bg.main,
                      fontSize: 11,
                      color: COLORS.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>No</span>
                    <span>Klasor Alani</span>
                    <span>Yol</span>
                  </div>

                  {folderFieldDefinitions.map(({ key, label }, index) => (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px minmax(220px, 320px) 1fr",
                        gap: 12,
                        alignItems: "start",
                        padding: "10px 12px",
                        borderBottom: index === folderFieldDefinitions.length - 1 ? "none" : `1px solid ${COLORS.border}`,
                      }}
                    >
                      <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>{index + 1}</span>

                      <div style={{ display: "grid", gap: 2 }}>
                        <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 11, color: COLORS.muted }}>
                          {key === "manuelRawKlasoru" ? "Phase1 manuel dosya yukleme hedef klasoru" : "Zorunlu klasor yolu"}
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                          <input
                            value={folderSettings[key]}
                            onChange={(event) => updateFolderField(key, event.target.value)}
                            placeholder="Klasör yolu girin veya seçin"
                            style={{
                              flex: 1,
                              padding: "10px 12px",
                              borderRadius: RADIUS.sm,
                              border: `1px solid ${folderErrors[key] ? COLORS.danger : COLORS.border}`,
                              background: COLORS.bg.surface,
                              color: COLORS.text,
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            title="Klasör seç"
                            disabled={folderLoading || folderSaving || !folderPickerSupported}
                            onClick={() => openFolderBrowser(
                              folderSettings[key],
                              (path) => updateFolderField(key, path),
                            )}
                          >
                            <Folder size={16} />
                          </Button>
                        </div>
                        {folderErrors[key] ? (
                          <span style={{ color: COLORS.danger, fontSize: 11 }}>{folderErrors[key]}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: COLORS.text, paddingTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={folderSettings.xlsxAktifMi}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, xlsxAktifMi: event.target.checked } : prev))}
                    />
                    XLSX export aktif
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: COLORS.text, paddingTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={folderSettings.opjAktifMi}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, opjAktifMi: event.target.checked } : prev))}
                    />
                    OPJ export aktif
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: COLORS.text, paddingTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={folderSettings.watcherAktifMi}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, watcherAktifMi: event.target.checked } : prev))}
                    />
                    Watcher aktif
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Yeniden deneme sayisi
                    <input
                      type="number"
                      min={0}
                      value={folderSettings.yenidenDenemeSayisi}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, yenidenDenemeSayisi: Math.max(0, Number(event.target.value) || 0) } : prev))}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Fis evrak no formati
                    <input
                      value={folderSettings.fisEvrakNoFormati}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, fisEvrakNoFormati: event.target.value } : prev))}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.muted }}>
                    Arsiv zaman damgasi formati
                    <input
                      value={folderSettings.arsivZamanDamgasiFormati}
                      onChange={(event) => setFolderSettings((prev) => (prev ? { ...prev, arsivZamanDamgasiFormati: event.target.value } : prev))}
                      style={{ padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface, color: COLORS.text }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: COLORS.muted, fontSize: 13 }}>
                Klasor ayarlari alinamadi. Baglantiyi kontrol edip yeniden deneyin.
              </div>
            )}
          </Card>
        )}

        {/* API Servisleri */}
        {activeSection === "services" && (
          <Card
            title="API Servisleri"
            subtitle="Harici entegrasyonları ve sistem modüllerini buradan yönetin"
            actions={
              <Button variant="secondary" size="sm" onClick={loadFeatures} disabled={featuresLoading}>
                {featuresLoading ? "Yükleniyor..." : "Yenile"}
              </Button>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, borderRadius: RADIUS.md, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Toplam Servis</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{features.length}</div>
              </div>
              <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Aktif Servisler</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.success }}>{features.filter((flag) => flag.enabled).length}</div>
              </div>
              <div style={{ padding: 12, borderRadius: RADIUS.md, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Pasif Servisler</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.danger }}>{features.filter((flag) => !flag.enabled).length}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16, padding: 12, borderRadius: RADIUS.md, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}` }}>
              <input
                value={serviceQuery}
                onChange={(event) => setServiceQuery(event.target.value)}
                placeholder="Servis ara"
                aria-label="Servis ara"
                style={{ minWidth: 220, flex: "1 1 220px", padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, color: COLORS.text }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "all" as const, label: "Tumu" },
                  { key: "active" as const, label: "Aktif" },
                  { key: "inactive" as const, label: "Pasif" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setServiceFilter(option.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: `1px solid ${serviceFilter === option.key ? COLORS.primary : COLORS.border}`,
                      background: serviceFilter === option.key ? `${COLORS.primary}12` : COLORS.bg.main,
                      color: serviceFilter === option.key ? COLORS.primary : COLORS.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", fontSize: 12, color: COLORS.muted }}>
                Gosterilen servis: {filteredFeatures.length}
              </div>
            </div>

            {featureError ? (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: RADIUS.md, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: COLORS.danger, fontSize: 12 }}>
                {featureError}
              </div>
            ) : null}
            {featuresLoading && features.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32, color: COLORS.muted }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ marginLeft: 8 }}>Servis durumları yükleniyor...</span>
              </div>
            ) : features.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted, fontSize: 13 }}>
                Servis bilgisi alınamadı. Backend bağlantısını kontrol edin.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filteredFeatures.map((flag) => {
                  const info = FEATURE_LABELS[flag.name] ?? { label: flag.name, description: "" };
                  const isToggling = togglingFlag === flag.name;
                  return (
                    <div
                      key={flag.name}
                      style={{
                        padding: 16,
                        background: flag.enabled ? "rgba(34,197,94,0.04)" : COLORS.bg.surface,
                        border: `1px solid ${flag.enabled ? "rgba(34,197,94,0.3)" : COLORS.border}`,
                        borderRadius: RADIUS.md,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Plug size={14} color={flag.enabled ? COLORS.success : COLORS.muted} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{info.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>{info.description}</div>
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: RADIUS.sm,
                              background: flag.enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                              color: flag.enabled ? COLORS.success : COLORS.danger,
                              fontWeight: 500,
                            }}
                          >
                            {flag.enabled ? "Aktif" : "Devre Dışı"}
                          </span>
                          <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted }}>
                            Son guncelleme: {getFeatureUpdatedAt(flag)}
                          </div>
                        </div>
                      </div>
                      <button type="button"
                        onClick={() => void handleToggleFeature(flag)}
                        disabled={isToggling}
                        aria-label={`${info.label} ${flag.enabled ? "devre dışı bırak" : "etkinleştir"}`}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          border: "none",
                          cursor: isToggling ? "wait" : "pointer",
                          background: flag.enabled ? COLORS.success : COLORS.muted,
                          position: "relative",
                          transition: "background 0.2s",
                          flexShrink: 0,
                          opacity: isToggling ? 0.6 : 1,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "white",
                            position: "absolute",
                            top: 3,
                            left: flag.enabled ? 23 : 3,
                            transition: "left 0.2s",
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {folderBrowserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.modal, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setFolderBrowserOpen(false); setFolderBrowserCallback(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setFolderBrowserOpen(false); setFolderBrowserCallback(null); } }}
        >
          <div
            style={{ background: COLORS.bg.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, width: 520, maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Klasor Sec</div>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setFolderBrowserOpen(false); setFolderBrowserCallback(null); }}>
                Kapat
              </Button>
            </div>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={folderBrowserPath}
                onChange={(e) => setFolderBrowserPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void loadBrowserDirectories(folderBrowserPath); }}
                style={{ flex: 1, padding: "8px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, color: COLORS.text, fontSize: 13 }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadBrowserDirectories(folderBrowserPath)}>
                Git
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", minHeight: 200, maxHeight: 360 }}>
              {folderBrowserLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Yukleniyor...</div>
              ) : (
                <>
                  {folderBrowserParent && (
                    <div
                      role="button"
                      tabIndex={0}
                      style={{ padding: "8px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: COLORS.primary, fontSize: 13 }}
                      onClick={() => void loadBrowserDirectories(folderBrowserParent)}
                      onKeyDown={(e) => { if (e.key === "Enter") void loadBrowserDirectories(folderBrowserParent); }}
                    >
                      <Folder size={14} /> ../ (Ust dizin)
                    </div>
                  )}
                  {folderBrowserDirs.length === 0 && !folderBrowserLoading && (
                    <div style={{ padding: "20px", textAlign: "center", color: COLORS.muted, fontSize: 13 }}>Alt dizin bulunamadi</div>
                  )}
                  {folderBrowserDirs.map((dir) => (
                    <div
                      key={dir.path}
                      role="button"
                      tabIndex={0}
                      style={{ padding: "8px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 13 }}
                      onClick={() => void loadBrowserDirectories(dir.path)}
                      onKeyDown={(e) => { if (e.key === "Enter") void loadBrowserDirectories(dir.path); }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = primaryRgba(0.08); }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <Folder size={14} /> {dir.name}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setFolderBrowserOpen(false); setFolderBrowserCallback(null); }}>
                Iptal
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={confirmFolderSelection}>
                Bu Klasoru Sec
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;




















