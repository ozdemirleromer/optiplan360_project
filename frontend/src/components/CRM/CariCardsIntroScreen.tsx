import { Users, CreditCard, TrendingUp, DollarSign, Clock, BarChart3, Shield, Zap } from "lucide-react";
import { TopBar } from "../Layout/TopBar";
import { Button, Card } from "../Shared";
import { COLORS, TYPOGRAPHY, RADIUS, primaryRgba } from "../Shared/constants";

interface CariCardsIntroScreenProps {
  onStart?: () => void;
}

export function CariCardsIntroScreen({ onStart }: CariCardsIntroScreenProps) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
      <TopBar title="Cari Kartları" subtitle="Müşteri ve tedarikçi yönetimi" />

      <div style={{ padding: "40px 20px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Hero Section */}
          <div style={{
            padding: "40px",
            background: primaryRgba(0.05),
            borderRadius: RADIUS.lg,
            border: `2px solid ${primaryRgba(0.3)}`,
            marginBottom: "40px",
            textAlign: "center"
          }}>
            <Users size={64} color={COLORS.primary.DEFAULT} style={{ margin: "0 auto 20px" }} />
            <h1 style={{ fontSize: 32, fontWeight: 700, color: COLORS.text, marginBottom: "12px" }}>
              Cari Kartları Yönetimi
            </h1>
            <p style={{ fontSize: 16, color: COLORS.muted, marginBottom: "24px", maxWidth: "600px", margin: "0 auto 24px" }}>
              Müşterileriniz ve tedarikçilerinizin tüm bilgilerini merkezi bir sistemde yönetin. Faturalama, kredi takibi ve iletişimi basitleştirin.
            </p>
            <Button variant="primary" size="lg" onClick={onStart}>
              Cari Kartı Oluştur
            </Button>
          </div>

          {/* Features Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "40px" }}>
            {[
              {
                icon: Users,
                title: "Merkezi Veri Tabanı",
                description: "Tüm müşteri ve tedarikçi bilgilerini tek yerde saklayın. Kişi adları, iletişim bilgileri, adresler ve notlar."
              },
              {
                icon: CreditCard,
                title: "Kredi Yönetimi",
                description: "Müşteri kredi limitlerini tanımlayın ve gerçek zamanlı bakiye takibi yapın. Bekleyen ödemeleri izleyin."
              },
              {
                icon: DollarSign,
                title: "Bakiye Takibi",
                description: "Her müşteri ve tedarikçinin alacak/borç bakiyesini görüntüleyin. Finansal durumları analiz edin."
              },
              {
                icon: Clock,
                title: "Ödeme Vadeleri",
                description: "Farklı müşteriler için vade tanımlayın. Vade gelen ödemeleri takip edin ve hatırlatmalar alın."
              },
              {
                icon: BarChart3,
                title: "Raporlama",
                description: "Müşteri analiz, satış raporları ve ödemeler raporlarını görüntüleyin. Trend analizi yapın."
              },
              {
                icon: Shield,
                title: "Kimlik Doğrulama",
                description: "Vergi numarası ve ticaret sicili bilgilerini kaydedin. Düzenlemelerle uyumlu kalın."
              },
              {
                icon: Zap,
                title: "Hızlı İşlemler",
                description: "Toplu cari kartı ithalatı, fiyat güncelleme ve durum değişiklikleri yapın."
              },
              {
                icon: TrendingUp,
                title: "Mikro Entegrasyonu",
                description: "Mikro ERP ile senkronize edin. Otomatik veri güncellemeleri alın ve raporları bağlayın."
              }
            ].map((feature, idx) => (
              <Card key={idx} title={feature.title} subtitle={feature.description}>
                <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
                  <feature.icon size={48} color={COLORS.primary.DEFAULT} />
                </div>
              </Card>
            ))}
          </div>

          {/* Getting Started Section */}
          <Card title="Başlamadan Önce Bilmeniz Gerekenler" style={{ marginBottom: "40px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", padding: "20px" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: "12px" }}>
                  Müşteri Bilgileri
                </h3>
                <ul style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.8 }}>
                  <li>- Firma adı ve tipi (Kurumsal/Bireysel)</li>
                  <li>- Vergi Kimlik Numarası (VKN)</li>
                  <li>- Vergi Dairesi</li>
                  <li>- İletişim Bilgileri (Telefon, E-posta)</li>
                  <li>- Tam Adres</li>
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: "12px" }}>
                  Ticari Şartlar
                </h3>
                <ul style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.8 }}>
                  <li>→ Kredi Limiti (0 = kasa satışı)</li>
                  <li>→ Ödeme Vadesi (gün cinsinden)</li>
                  <li>→ Indirim Yüzdesi (opsiyonel)</li>
                  <li>→ Mikro ERP Cari Kodu (varsa)</li>
                  <li>→ Özel Notlar ve Aksaklıklar</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Cari Türleri */}
          <Card title="Cari Türleri">
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{
                padding: "16px",
                background: COLORS.bg.surface,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "8px" }}>
                  MÜŞTERİLER
                </h4>
                <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: "12px" }}>
                  Ürün ve hizmet alan taraflar. Satışları kaydedersiniz, alacak oluşur.
                </p>
                <ul style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                  <li>• Alacak bakiyesi takibi</li>
                  <li>• Fatura hazırlama</li>
                  <li>• Ödeme takibi</li>
                </ul>
              </div>
              <div style={{
                padding: "16px",
                background: COLORS.bg.surface,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "8px" }}>
                  TEDARİKÇİLER
                </h4>
                <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: "12px" }}>
                  Ürün satıp hizmet sunan taraflar. Satın alma kaydedersiniz, borç oluşur.
                </p>
                <ul style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                  <li>• Borç bakiyesi takibi</li>
                  <li>• Satın alma siparişi</li>
                  <li>• Ödeme planlaması</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Quick Start */}
          <Card title="Hızlı Başlangıç" style={{ marginTop: "20px", marginBottom: "40px" }}>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  { step: "1", title: "Cari Tipi Seç", desc: "Müşteri veya Tedarikçi" },
                  { step: "2", title: "Taban Bilgiler", desc: "Firma adı ve İletişim" },
                  { step: "3", title: "Ticari Şartlar", desc: "Kredi ve Vade Tanımı" },
                  { step: "4", title: "Kaydet", desc: "Sistem kaydeder" }
                ].map((item) => (
                  <div key={item.step} style={{ textAlign: "center" }}>
                    <div style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      background: primaryRgba(0.15),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 700,
                      color: COLORS.primary.DEFAULT,
                      margin: "0 auto 12px"
                    }}>
                      {item.step}
                    </div>
                    <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: "4px", fontSize: 14 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* CTA Footer */}
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <Button variant="primary" size="lg" onClick={onStart} style={{ marginRight: "12px" }}>
              Cari Kartı Oluştur
            </Button>
            <Button variant="secondary" size="lg">
              Bakiye Raporlarını Görüntüle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
