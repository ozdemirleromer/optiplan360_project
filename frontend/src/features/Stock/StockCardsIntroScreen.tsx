import { AlertCircle, BarChart3, Grid3x3, PackageOpen, TrendingUp, Zap } from "lucide-react";

import { navigateToAppPage } from "../../utils/appNavigation";
import { TopBar } from "../../components/Layout/TopBar";
import { Button, Card } from "../../components/Shared";
import { COLORS, primaryRgba, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";

interface StockCardsIntrScreenProps {
  onStart?: () => void;
  onOpenReports?: () => void;
}

export function StockCardsIntroScreen({ onStart, onOpenReports }: StockCardsIntrScreenProps) {
  const handleOpenReports = () => {
    if (onOpenReports) {
      onOpenReports();
      return;
    }

    navigateToAppPage("reports-analytics", "stock-cards-intro");
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
      <TopBar title="Stok Kartları" subtitle="Envanter yönetimi ve ürün tanımlaması" />

      <div style={{ padding: "40px 20px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              padding: "40px",
              background: primaryRgba(0.05),
              borderRadius: RADIUS.lg,
              border: `2px solid ${primaryRgba(0.3)}`,
              marginBottom: "40px",
              textAlign: "center",
            }}
          >
            <PackageOpen size={64} color={COLORS.primary} style={{ margin: "0 auto 20px" }} />
            <h1 style={{ fontSize: 32, fontWeight: 700, color: COLORS.text, marginBottom: "12px" }}>
              Stok Kartları Yönetimi
            </h1>
            <p
              style={{
                fontSize: 16,
                color: COLORS.muted,
                marginBottom: "24px",
                maxWidth: "600px",
                margin: "0 auto 24px",
              }}
            >
              Ürünlerinizi merkezi bir sistemde tanımlayın, stok seviyelerini takip edin ve envanterle ilgili tüm
              işlemleri otomatikleştirin.
            </p>
            <Button variant="primary" size="lg" onClick={onStart}>
              Stok Kartı Oluştur
            </Button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
              marginBottom: "40px",
            }}
          >
            {[
              {
                icon: Grid3x3,
                title: "Organize Ürünler",
                description:
                  "Ürünlerinizi kategori, birim ve özelliklerine göre organize edin. Her ürün için benzersiz kod ve açıklama tanımlayın.",
              },
              {
                icon: TrendingUp,
                title: "Stok Takibi",
                description:
                  "Gerçek zamanlı stok seviyelerini izleyin. Minimum stok uyarıları alın ve otomatik siparişler tetikleyin.",
              },
              {
                icon: AlertCircle,
                title: "Uyarılar & Bildirimler",
                description:
                  "Stok biten ürünler hakkında anında haberdar olun. Kritik seviyelere ulaşan ürünleri yönetin.",
              },
              {
                icon: Zap,
                title: "Hızlı İşlemler",
                description:
                  "Toplu ürün yükleme, fiyat güncelleme ve stok ayarlamaları yapın. Zaman kazanın, verimliliği artırın.",
              },
              {
                icon: BarChart3,
                title: "Raporlama",
                description: "Stok değeri, hareket raporları ve analizleri görüntüleyin. Veri odaklı kararlar alın.",
              },
              {
                icon: PackageOpen,
                title: "Entegrasyonlar",
                description:
                  "Mikro ERP, Muhasebe ve diğer sistemlerle senkronize edin. Otomatik veri güncellemeleri alın.",
              },
            ].map((feature, idx) => (
              <Card key={idx} title={feature.title} subtitle={feature.description}>
                <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
                  <feature.icon size={48} color={COLORS.primary} />
                </div>
              </Card>
            ))}
          </div>

          <Card title="Başlamadan Önce Bilmeniz Gerekenler" style={{ marginBottom: "40px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", padding: "20px" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: "12px" }}>
                  Temel Bilgiler
                </h3>
                <ul style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.8 }}>
                  <li>- Ürün adı ve kodu (benzersiz olmalı)</li>
                  <li>- Birim tipi (ADET, KG, LİTRE, vb.)</li>
                  <li>- Kategori ve alt kategori</li>
                  <li>- Alış ve satış fiyatı</li>
                  <li>- Minimum stok seviyesi</li>
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: "12px" }}>Öneriler</h3>
                <ul style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.8 }}>
                  <li>→ Ürün kodlarında tutarlı bir format kullanın</li>
                  <li>→ Kategorileri mantıksal olarak gruplandırın</li>
                  <li>→ Minimum stok seviyelerini gerçekçi belirleyin</li>
                  <li>→ Düzenli envanter sayımları yapın</li>
                  <li>→ Raporları periyodik olarak kontrol edin</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Hızlı Başlangıç">
            <div style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  { step: "1", title: "Kategori Oluştur", desc: "Ürün kategorileri tanımlayın" },
                  { step: "2", title: "Ürün Ekle", desc: "Stok kartları oluşturun" },
                  { step: "3", title: "Fiyat Belirle", desc: "Birim fiyatlarını ayarlayın" },
                  { step: "4", title: "Stok Ayarla", desc: "Başlangıç stokunuzu girin" },
                ].map((item) => (
                  <div key={item.step} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        background: primaryRgba(0.15),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 700,
                        color: COLORS.primary,
                        margin: "0 auto 12px",
                      }}
                    >
                      {item.step}
                    </div>
                    <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: "4px", fontSize: 14 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <Button variant="primary" size="lg" onClick={onStart} style={{ marginRight: "12px" }}>
              Stok Kartı Oluştur
            </Button>
            <Button variant="secondary" size="lg" onClick={handleOpenReports}>
              Raporları Görüntüle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



