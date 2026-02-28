import { useState, type ReactNode } from "react";
import { Building2, MessageSquare, Camera, Settings } from "lucide-react";
import { TopBar } from "../Layout/TopBar";
import { Card, Button } from "../Shared";
import { COLORS, TYPOGRAPHY } from "../Shared/constants";
import { MikroConfigModal } from "../../features/Integrations";

interface SimpleIntegration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  icon: ReactNode;
}

export function SimpleIntegrationsPage() {
  const [mikroConfigOpen, setMikroConfigOpen] = useState(false);
  const [integrations, setIntegrations] = useState<SimpleIntegration[]>([
    {
      id: "mikro",
      name: "Mikro ERP",
      description: "Müşteri ve sipariş verileri senkronizasyonu",
      status: "connected",
      icon: <Building2 size={20} aria-hidden />
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      description: "Müşteri bildirimleri ve durum güncellemeleri",
      status: "disconnected",
      icon: <MessageSquare size={20} aria-hidden />
    },
    {
      id: "ocr",
      name: "OCR",
      description: "Otomatik sipariş tanıma ve dijitalleştirme",
      status: "connected",
      icon: <Camera size={20} aria-hidden />
    }
  ]);

  const handleToggleIntegration = (id: string) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === id 
          ? { 
              ...integration, 
              status: integration.status === "connected" ? "disconnected" : "connected" 
            }
          : integration
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return COLORS.success.DEFAULT;
      case "error": return COLORS.error.DEFAULT;
      default: return COLORS.gray[400];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected": return "Bağlı";
      case "error": return "Hata";
      default: return "Bağlı Değil";
    }
  };

  return (
    <div>
      <TopBar 
        title="Entegrasyonlar" 
        subtitle="Harici sistem bağlantıları" 
        breadcrumbs={["Ana İşlemler", "Entegrasyonlar"]} 
      />
      
      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 20 }}>
          {integrations.map((integration) => (
            <Card key={integration.id} title={integration.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 32 }}>{integration.icon}</div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 14, 
                    color: COLORS.muted, 
                    marginBottom: 4 
                  }}>
                    {integration.description}
                  </div>
                  
                  <div style={{ 
                    fontSize: 12, 
                    color: getStatusColor(integration.status),
                    fontWeight: TYPOGRAPHY.fontWeight.semibold
                  }}>
                    Durum: {getStatusText(integration.status)}
                  </div>
                </div>
                
                <div style={{ display: "flex", gap: 8 }}>
                  {integration.id === "mikro" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMikroConfigOpen(true)}
                      title="Yapılandır"
                    >
                      <Settings size={14} aria-hidden /> Yapılandır
                    </Button>
                  )}
                  <Button
                    variant={integration.status === "connected" ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => handleToggleIntegration(integration.id)}
                  >
                    {integration.status === "connected" ? "Bağlantıyı Kes" : "Bağlan"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        
        <div style={{ marginTop: 32 }}>
          <Card title="Yardım">
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px 0" }}>
                <strong>Entegrasyonlar</strong> harici sistemlerle OPTIPLAN 360 arasında veri alışverişi sağlar.
              </p>
              <p style={{ margin: "0 0 12px 0" }}>
                • <strong>Mikro ERP:</strong> Müşteri ve sipariş bilgilerini otomatik olarak senkronize eder<br/>
                • <strong>WhatsApp:</strong> Müşterilere otomatik bildirimler gönderir<br/>
                • <strong>OCR:</strong> Kağıt siparişleri dijital forma dönüştürür
              </p>
              <p style={{ margin: 0 }}>
                Daha fazla bilgi için sistem yöneticinizle iletişime geçin.
              </p>
            </div>
          </Card>
        </div>
      </div>
      <MikroConfigModal
        isOpen={mikroConfigOpen}
        onClose={() => setMikroConfigOpen(false)}
        onSave={() => {
          setIntegrations(prev =>
            prev.map(i => i.id === "mikro" ? { ...i, status: "connected" } : i)
          );
        }}
      />
    </div>
  );
}
