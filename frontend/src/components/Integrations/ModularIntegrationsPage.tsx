import { useState, useCallback, type ReactNode } from "react";
import { Link, Database, Smartphone, Search, Cloud, FileText, Globe, Mail, MessageSquare, Receipt, Truck, Cpu } from "lucide-react";
import { Card, Button, Badge } from "../Shared";
import { TopBar } from "../Layout/TopBar";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { integrationService } from "../../services/integrationService";
import {
  AzureConfigModal,
  GoogleConfigModal,
  AWSConfigModal,
  TesseractConfigModal,
  TelegramConfigModal,
  EmailConfigModal,
  MikroConfigModal,
  SMTPConfigModal,
  SMSConfigModal,
  WhatsAppConfigModal,
  AIConfigModal,
  OptiPlanningConfigModal,
  type AzureConfig,
  type GoogleConfig,
  type AWSConfig,
  type TesseractConfig,
  type TelegramConfig,
  type EmailConfig,
  type SMTPConfig,
  type SMSConfig,
  type WhatsAppConfig,
  type AIConfig,
  type OptiPlanningConfig,
} from "../../features/Integrations";

type IntegrationConfig =
  | AzureConfig
  | GoogleConfig
  | AWSConfig
  | TesseractConfig
  | TelegramConfig
  | EmailConfig
  | SMTPConfig
  | SMSConfig
  | WhatsAppConfig
  | AIConfig
  | OptiPlanningConfig
  | Record<string, unknown>;

interface IntegrationModule {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  category: string;
  status: "connected" | "disconnected" | "error";
  config?: IntegrationConfig;
  lastSync?: string;
}

export function ModularIntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Modal states
  const [azureModalOpen, setAzureModalOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [awsModalOpen, setAwsModalOpen] = useState(false);
  const [tesseractModalOpen, setTesseractModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [mikroModalOpen, setMikroModalOpen] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [optiplanningModalOpen, setOptiplanningModalOpen] = useState(false);

  const [integrations, setIntegrations] = useState<IntegrationModule[]>([
    {
      id: "ai-engine",
      name: "AI Karar Motoru",
      description: "Üretim darboğazı tespiti ve kapasite tahmini",
      icon: <Cpu size={20} aria-hidden />,
      category: "ai",
      status: "disconnected",
      config: {
        provider: "openai",
        model: "gpt-4o",
      } as Partial<AIConfig>
    },
    {
      id: "smtp",
      name: "SMTP Mail",
      description: "Sistem ve raporlama e-postaları gönderimi",
      icon: <Mail size={20} aria-hidden />,
      category: "communication",
      status: "disconnected",
      config: {
        host: "",
        port: 587,
      } as Partial<SMTPConfig>
    },
    {
      id: "sms",
      name: "SMS Gateway",
      description: "Kullanıcı bildirimleri için SMS entegrasyonu",
      icon: <MessageSquare size={20} aria-hidden />,
      category: "communication",
      status: "disconnected",
      config: {
        provider: "ILETI_MERKEZI",
        senderName: "OPTIPLAN",
      } as Partial<SMSConfig>
    },
    {
      id: "e-fatura",
      name: "E-Fatura",
      description: "E-Fatura gönderim ve alım işlemleri",
      icon: <Receipt size={20} aria-hidden />,
      category: "finance",
      status: "disconnected",
    },
    {
      id: "kargo",
      name: "Kargo Entegrasyonu",
      description: "Kargo takibi ve barkod oluşturma",
      icon: <Truck size={20} aria-hidden />,
      category: "logistics",
      status: "disconnected",
    },
    {
      id: "mikro-erp",
      name: "Mikro ERP",
      description: "Mikro ERP sistemi ile veri senkronizasyonu",
      icon: <Database size={20} aria-hidden />,
      category: "database",
      status: "disconnected",
      config: {
        host: "",
        port: 1433,
        database: "",
        username: "",
        password: ""
      }
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description: "Müşteri bildirimleri için WhatsApp entegrasyonu",
      icon: <Smartphone size={20} aria-hidden />,
      category: "communication",
      status: "disconnected",
      config: {
        phoneNumberId: "",
        accessToken: ""
      }
    },
    {
      id: "azure-ocr",
      name: "Azure Computer Vision",
      description: "Microsoft Azure OCR servisi",
      icon: <Cloud size={20} color="#0078D4" aria-hidden />,
      category: "ocr",
      status: "disconnected",
      config: {
        endpoint: "",
        key: ""
      }
    },
    {
      id: "google-ocr",
      name: "Google Vision API",
      description: "Google Cloud OCR servisi",
      icon: <Globe size={20} aria-hidden />,
      category: "ocr",
      status: "disconnected",
      config: {
        projectId: "",
        jsonKey: ""
      }
    },
    {
      id: "aws-textract",
      name: "AWS Textract",
      description: "Amazon Web Services OCR servisi",
      icon: <Cloud size={20} color="#FF9900" aria-hidden />,
      category: "ocr",
      status: "disconnected",
      config: {
        accessKeyId: "",
        secretAccessKey: "",
        region: "us-east-1"
      }
    },
    {
      id: "tesseract",
      name: "Tesseract OCR",
      description: "Open source OCR motoru",
      icon: <FileText size={20} aria-hidden />,
      category: "ocr",
      status: "disconnected",
      config: {
        languages: "tur+eng",
        path: ""
      }
    },
    {
      id: "optiplanning",
      name: "Biesse OptiPlanning",
      description: "Master Handoff Gövde-Arkalık Optimizasyon Entegrasyonu",
      icon: <FileText size={20} aria-hidden />,
      category: "logistics",
      status: "disconnected",
      config: {
        exportDir: "C:\\Biesse\\OptiPlanning\\XmlJob",
        exePath: "C:\\Biesse\\OptiPlanning\\System\\OptiPlan.exe",
        formatType: "EXCEL",
        autoTrigger: true
      } as Partial<OptiPlanningConfig>
    }
  ]);

  const categories: Array<{ id: string; name: string; icon: ReactNode }> = [
    { id: "all", name: "Tümü", icon: <Link size={16} aria-hidden /> },
    { id: "database", name: "Veritabanı", icon: <Database size={16} aria-hidden /> },
    { id: "communication", name: "İletişim", icon: <Smartphone size={16} aria-hidden /> },
    { id: "ocr", name: "OCR", icon: <Search size={16} aria-hidden /> },
    { id: "ai", name: "Yapay Zeka", icon: <Cpu size={16} aria-hidden /> },
    { id: "finance", name: "Finans", icon: <Receipt size={16} aria-hidden /> },
    { id: "logistics", name: "Lojistik", icon: <Truck size={16} aria-hidden /> }
  ];

  const filteredIntegrations = integrations.filter(integration =>
    activeCategory === "all" || integration.category === activeCategory
  );

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected": return "Bağlı";
      case "disconnected": return "Bağlı Değil";
      case "error": return "Hata";
      default: return "Bilinmiyor";
    }
  };

  const handleTestConnection = useCallback(async (integrationId: string) => {
    try {
      const health = await integrationService.getHealth();
      const isHealthy = health && (health as unknown as Record<string, unknown>).status !== "error";
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: isHealthy ? "connected" : "error", lastSync: new Date().toLocaleString("tr-TR") }
          : integration
      ));
    } catch {
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: "error" }
          : integration
      ));
    }
  }, []);

  const handleDisconnect = useCallback(async (integrationId: string) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, status: "disconnected", lastSync: undefined }
        : integration
    ));
  }, []);

  const handleOpenConfig = useCallback((integrationId: string) => {
    switch (integrationId) {
      case "azure-ocr":
        setAzureModalOpen(true);
        break;
      case "google-ocr":
        setGoogleModalOpen(true);
        break;
      case "aws-textract":
        setAwsModalOpen(true);
        break;
      case "tesseract":
        setTesseractModalOpen(true);
        break;
      case "telegram-ocr":
        setTelegramModalOpen(true);
        break;
      case "email-ocr":
        setEmailModalOpen(true);
        break;
      case "mikro-erp":
        setMikroModalOpen(true);
        break;
      case "whatsapp":
        setWhatsappModalOpen(true);
        break;
      case "ai-engine":
        setAiModalOpen(true);
        break;
      case "optiplanning":
        setOptiplanningModalOpen(true);
        break;
      case "smtp":
        setSmtpModalOpen(true);
        break;
      case "sms":
        setSmsModalOpen(true);
        break;
      case "e-fatura":
        // Bu sadece toggle edilecek, modal'a gerek yok
        setIntegrations(prev => prev.map(integration =>
          integration.id === integrationId
            ? { ...integration, status: integration.status === "connected" ? "disconnected" : "connected" }
            : integration
        ));
        break;
      case "kargo":
        // Bu sadece toggle edilecek
        setIntegrations(prev => prev.map(integration =>
          integration.id === integrationId
            ? { ...integration, status: integration.status === "connected" ? "disconnected" : "connected" }
            : integration
        ));
        break;
      default:
        break;
    }
  }, []);

  const handleConfigSave = useCallback(<T extends IntegrationConfig>(integrationId: string, config: T) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, config, status: "connected" }
        : integration
    ));
  }, []);

  // Get integration by ID
  const getIntegration = (id: string) => integrations.find(i => i.id === id);
  const getIntegrationConfig = <T extends IntegrationConfig>(id: string): T | undefined =>
    getIntegration(id)?.config as T | undefined;

  return (
    <div className="electric-page">
      <TopBar
        title="Moduler Entegrasyonlar"
        subtitle="Harici servisler ve baglantilar"
        breadcrumbs={["Entegrasyonlar", "Moduler Yapi"]}
      />
      <div className="app-page-container">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: COLORS.text }}>
            Modüler Entegrasyonlar
          </h1>
          <p style={{ margin: "8px 0 0", color: COLORS.muted, fontSize: 14 }}>
            Harici sistemleri ve servisleri yapılandırın
          </p>
        </div>

        {/* Category Filter */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: activeCategory === category.id ? 700 : 400,
                color: activeCategory === category.id ? COLORS.primary.DEFAULT : COLORS.muted,
                background: activeCategory === category.id ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: activeCategory === category.id ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>

        {/* Integrations Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
          {filteredIntegrations.map(integration => (
            <Card key={integration.id} style={{ height: "100%" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 24 }}>{integration.icon}</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
                    {integration.name}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted, lineHeight: 1.4 }}>
                    {integration.description}
                  </p>
                </div>
                <Badge
                  variant={integration.status === "connected" ? "success" : integration.status === "error" ? "danger" : "secondary"}
                  style={{ fontSize: 11 }}
                >
                  {getStatusText(integration.status)}
                </Badge>
              </div>

              {integration.lastSync && (
                <div style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 16,
                  padding: "8px 12px",
                  background: `${COLORS.success[500]}10`,
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.success[500]}20`
                }}>
                  Son senkronizasyon: {integration.lastSync}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                {integration.status === "connected" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDisconnect(integration.id)}
                  >
                    Bağlantıyı Kes
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleTestConnection(integration.id)}
                  >
                    Bağlan
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenConfig(integration.id)}
                >
                  Yapılandır
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {filteredIntegrations.length === 0 && (
          <Card>
            <div style={{
              textAlign: "center",
              padding: 40,
              color: COLORS.muted,
              fontSize: 14
            }}>
              Bu kategoride entegrasyon bulunamadı.
            </div>
          </Card>
        )}
        {/* Modals */}
        <AzureConfigModal
          isOpen={azureModalOpen}
          onClose={() => setAzureModalOpen(false)}
          onSave={(config) => handleConfigSave("azure-ocr", config)}
          initialConfig={getIntegrationConfig<AzureConfig>("azure-ocr")}
        />
        <GoogleConfigModal
          isOpen={googleModalOpen}
          onClose={() => setGoogleModalOpen(false)}
          onSave={(config) => handleConfigSave("google-ocr", config)}
          initialConfig={getIntegrationConfig<GoogleConfig>("google-ocr")}
        />
        <AWSConfigModal
          isOpen={awsModalOpen}
          onClose={() => setAwsModalOpen(false)}
          onSave={(config) => handleConfigSave("aws-textract", config)}
          initialConfig={getIntegrationConfig<AWSConfig>("aws-textract")}
        />
        <TesseractConfigModal
          isOpen={tesseractModalOpen}
          onClose={() => setTesseractModalOpen(false)}
          onSave={(config) => handleConfigSave("tesseract", config)}
          initialConfig={getIntegrationConfig<TesseractConfig>("tesseract")}
        />
        <TelegramConfigModal
          isOpen={telegramModalOpen}
          onClose={() => setTelegramModalOpen(false)}
          onSave={(config) => handleConfigSave("telegram-ocr", config)}
          initialConfig={getIntegrationConfig<TelegramConfig>("telegram-ocr")}
        />
        <EmailConfigModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          onSave={(config) => handleConfigSave("email-ocr", config)}
          initialConfig={getIntegrationConfig<EmailConfig>("email-ocr")}
        />
        <MikroConfigModal
          isOpen={mikroModalOpen}
          onClose={() => setMikroModalOpen(false)}
          onSave={(config) => handleConfigSave("mikro-erp", config)}
          initialConfig={getIntegrationConfig<Record<string, unknown>>("mikro-erp")}
        />
        <SMTPConfigModal
          isOpen={smtpModalOpen}
          onClose={() => setSmtpModalOpen(false)}
          onSave={(config) => handleConfigSave("smtp", config)}
          initialConfig={getIntegrationConfig<SMTPConfig>("smtp")}
        />
        <SMSConfigModal
          isOpen={smsModalOpen}
          onClose={() => setSmsModalOpen(false)}
          onSave={(config) => handleConfigSave("sms", config)}
          initialConfig={getIntegrationConfig<SMSConfig>("sms")}
        />
        <AIConfigModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          onSave={(config) => handleConfigSave("ai-engine", config)}
          initialConfig={getIntegrationConfig<AIConfig>("ai-engine")}
        />
        <OptiPlanningConfigModal
          isOpen={optiplanningModalOpen}
          onClose={() => setOptiplanningModalOpen(false)}
          onSave={(config) => handleConfigSave("optiplanning", config)}
          initialConfig={getIntegrationConfig<OptiPlanningConfig>("optiplanning")}
        />
        <WhatsAppConfigModal
          isOpen={whatsappModalOpen}
          onClose={() => setWhatsappModalOpen(false)}
          onSave={(config) => handleConfigSave("whatsapp", config)}
          initialConfig={getIntegrationConfig<WhatsAppConfig>("whatsapp")}
        />
      </div>
    </div>
  );
}
