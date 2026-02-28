import { useEffect, useState, type FormEvent } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "../Shared";
import { COLORS, RADIUS, primaryRgba } from "../Shared/constants";
import {
  crmService,
  type CRMAccount,
  type CRMContact,
  type CRMOpportunity,
  type CRMQuote,
  type CRMStats,
  type QuoteInput,
  OpportunityStage,
} from "../../services/crmService";
import {
  integrationService,
  type HealthStatus,
  type IntegrationError,
  type IntegrationAudit,
} from "../../services/integrationService";

// ── CRM Wrapper — üst sayfa CardManagementPage tarafından çağırılır ──
export function CRMDashboardTab() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [statsData, healthData] = await Promise.all([
        crmService.getStats(),
        integrationService.getHealth(),
      ]);
      setStats(statsData);
      setHealth(healthData);
    } catch (err) {
      console.error("CRM verisi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card title="Yükleniyor...">
        <div style={{ padding: "40px", textAlign: "center", color: COLORS.muted }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
          Veriler getiriliyor...
        </div>
      </Card>
    );
  }

  return <DashboardTab stats={stats} health={health} />;
}

// Geriye dönük uyumluluk — eski import'lar için alias
export const CRMPage = CRMDashboardTab;

// ── Dashboard Tab ──
export function DashboardTab({ stats, health }: { stats: CRMStats | null; health: HealthStatus | null }) {
  const pipelineValue = typeof stats?.pipelineValue === "number" ? stats.pipelineValue : 0;
  const avgCloseProbability = typeof stats?.avgCloseProbability === "number" ? stats.avgCloseProbability : null;
  const activeAccounts = stats?.activeAccounts ?? stats?.totalAccounts ?? 0;
  const totalAccounts = stats?.totalAccounts ?? stats?.activeAccounts ?? 0;
  const stageDistribution =
    stats?.stageDistribution ??
    (stats?.pipeline
      ? Object.fromEntries(Object.entries(stats.pipeline).map(([stage, value]) => [stage, value.count]))
      : null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
      {/* Pipeline Stats */}
      <Card title="Pipeline Değeri" subtitle="Toplam fırsat değeri">
        <div style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.primary.DEFAULT, marginBottom: "8px" }}>
            ₺{pipelineValue.toLocaleString("tr-TR")}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Ortalama Kapanış Olasılığı:{" "}
            <span style={{ fontWeight: 600, color: COLORS.text }}>
              {avgCloseProbability !== null ? `%${avgCloseProbability.toFixed(0)}` : "-"}
            </span>
          </div>
        </div>
      </Card>

      {/* Accounts */}
      <Card title="Cari Hesaplar" subtitle="Aktif müşteri sayısı">
        <div style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.success.DEFAULT, marginBottom: "8px" }}>
            {activeAccounts}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Toplam: <span style={{ fontWeight: 600, color: COLORS.text }}>{totalAccounts}</span>
          </div>
        </div>
      </Card>

      {/* Opportunities */}
      <Card title="Fırsatlar" subtitle="Açık fırsat sayısı">
        <div style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.warning.DEFAULT, marginBottom: "8px" }}>
            {stats?.totalOpportunities || 0}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>Pipeline'da</div>
        </div>
      </Card>

      {/* Integration Health */}
      <Card title="Entegrasyon Sağlık" subtitle="Mikro ERP durumu">
        <div style={{ padding: "12px 0" }}>
          <Badge
            variant={
              health?.status === "HEALTHY"
                ? "success"
                : health?.status === "DEGRADED"
                  ? "warning"
                  : "danger"
            }
          >
            {health?.status || "UNKNOWN"}
          </Badge>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: "12px" }}>
            Bekleyen İşlem: <span style={{ fontWeight: 600, color: COLORS.text }}>{health?.outboxPending || 0}</span>
          </div>
        </div>
      </Card>

      {/* Stage Distribution */}
      {stageDistribution && Object.keys(stageDistribution).length > 0 && (
        <Card title="Aşama Dağılımı" subtitle="Pipeline aşamalarına göre" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px 0" }}>
            {Object.entries(stageDistribution).map(([stage, count]) => (
              <div
                key={stage}
                style={{
                  flex: "1 1 150px",
                  padding: "12px",
                  background: primaryRgba(0.05),
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: "4px" }}>
                  {stage.replace("_", " ")}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.primary.DEFAULT }}>{count}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Accounts Tab ──
export function AccountsTab() {
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CRMAccount | null>(null);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const initialCreateForm = {
    company_name: "",
    account_type: "CORPORATE",
    tax_id: "",
    tax_office: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    district: "",
    website: "",
    industry: "",
    credit_limit: "",
    payment_term_days: "",
    mikro_cari_kod: "",
    plaka_birim_fiyat: "",
    bant_metre_fiyat: "",
    notes: "",
  };

  const [createForm, setCreateForm] = useState(initialCreateForm);

  const accountTypeOptions = [
    { value: "CORPORATE", label: "Kurumsal" },
    { value: "PERSONAL", label: "Bireysel" },
  ];

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const data = await crmService.listAccounts({ is_active: true });
      setAccounts(data);
    } catch (err) {
      console.error("Cari hesaplar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }

  async function selectAccount(account: CRMAccount) {
    setSelectedAccount(account);
    try {
      const contactsData = await crmService.listContacts({ account_id: account.id });
      setContacts(contactsData);
    } catch (err) {
      console.error("Kişiler yüklenemedi:", err);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const companyName = createForm.company_name.trim();

    if (!companyName) {
      setCreateError("Firma adı zorunludur.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        company_name: companyName,
        account_type: createForm.account_type,
        tax_id: createForm.tax_id || undefined,
        tax_office: createForm.tax_office || undefined,
        phone: createForm.phone || undefined,
        email: createForm.email || undefined,
        address: createForm.address || undefined,
        city: createForm.city || undefined,
        district: createForm.district || undefined,
        website: createForm.website || undefined,
        industry: createForm.industry || undefined,
        credit_limit: createForm.credit_limit ? Number(createForm.credit_limit) : undefined,
        payment_term_days: createForm.payment_term_days ? Number(createForm.payment_term_days) : undefined,
        mikro_cari_kod: createForm.mikro_cari_kod || undefined,
        plaka_birim_fiyat: createForm.plaka_birim_fiyat ? Number(createForm.plaka_birim_fiyat) : undefined,
        bant_metre_fiyat: createForm.bant_metre_fiyat ? Number(createForm.bant_metre_fiyat) : undefined,
        notes: createForm.notes || undefined,
      };

      const created = await crmService.createAccount(payload);
      setAccounts((prev) => [created, ...prev]);
      setSelectedAccount(created);
      setContacts([]);
      setCreateForm(initialCreateForm);
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cari hesap oluşturulamadı.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card title="Cari Hesaplar">
        <div style={{ padding: "20px", textAlign: "center", color: COLORS.muted }}>Yükleniyor...</div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: selectedAccount ? "1fr 1fr" : "1fr", gap: "20px" }}>
        {/* Accounts List */}
        <Card
          title="Cari Hesaplar"
          subtitle={`${accounts.length} aktif hesap`}
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setCreateForm(initialCreateForm);
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              + Yeni Cari
            </Button>
          }
        >
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {accounts.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: COLORS.muted }}>Henüz cari hesap yok</div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => selectAccount(account)}
                  style={{
                    padding: "12px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    cursor: "pointer",
                    background: selectedAccount?.id === account.id ? primaryRgba(0.05) : "transparent",
                    transition: "background 0.2s ease",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: "4px" }}>
                    {account.companyName}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted, display: "flex", gap: "12px" }}>
                    {account.taxId && <span>VKN: {account.taxId}</span>}
                    {account.mikroCariKod && <span>Mikro: {account.mikroCariKod}</span>}
                  </div>
                  {account.balance !== undefined && account.balance !== 0 && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: account.balance > 0 ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
                        marginTop: "6px",
                      }}
                    >
                      Bakiye: ₺{account.balance.toLocaleString("tr-TR")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Account Detail */}
        {selectedAccount && (
          <Card
            title={selectedAccount.companyName}
            subtitle="Cari Detayı"
          >
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              {selectedAccount.taxId && (
                <div>
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}>VKN:</span>{" "}
                  <span style={{ color: COLORS.text }}>{selectedAccount.taxId}</span>
                </div>
              )}
              {selectedAccount.taxOffice && (
                <div>
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}>Vergi Dairesi:</span>{" "}
                  <span style={{ color: COLORS.text }}>{selectedAccount.taxOffice}</span>
                </div>
              )}
              {selectedAccount.phone && (
                <div>
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}>Telefon:</span>{" "}
                  <span style={{ color: COLORS.text }}>{selectedAccount.phone}</span>
                </div>
              )}
              {selectedAccount.email && (
                <div>
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}>E-posta:</span>{" "}
                  <span style={{ color: COLORS.text }}>{selectedAccount.email}</span>
                </div>
              )}
              {selectedAccount.address && (
                <div>
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}>Adres:</span>{" "}
                  <span style={{ color: COLORS.text }}>{selectedAccount.address}</span>
                </div>
              )}
              {(selectedAccount.mikroCariKod || selectedAccount.plakaBirimFiyat || selectedAccount.bantMetreFiyat) && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedAccount.mikroCariKod && (
                    <Badge variant="info">Mikro Kod: {selectedAccount.mikroCariKod}</Badge>
                  )}
                  {selectedAccount.plakaBirimFiyat != null && (
                    <Badge variant="success">Plaka: {selectedAccount.plakaBirimFiyat} TL/adet</Badge>
                  )}
                  {selectedAccount.bantMetreFiyat != null && (
                    <Badge variant="success">Bant: {selectedAccount.bantMetreFiyat} TL/m</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Contacts */}
            <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${COLORS.border}` }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "12px" }}>
                Kişiler ({contacts.length})
              </h4>
              {contacts.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.muted }}>Henüz kişi eklenmemiş</div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      padding: "8px",
                      background: COLORS.bg.surface,
                      borderRadius: RADIUS.sm,
                      marginBottom: "8px",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: COLORS.text }}>
                      {contact.firstName} {contact.lastName}
                      {contact.isPrimary && (
                        <span style={{ marginLeft: "8px" }}>
                          <Badge variant="info">Birincil</Badge>
                        </span>
                      )}
                    </div>
                    {contact.title && <div style={{ fontSize: 12, color: COLORS.muted }}>{contact.title}</div>}
                    {contact.email && (
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: "4px" }}>{contact.email}</div>
                    )}
                    {contact.phone && <div style={{ fontSize: 12, color: COLORS.muted }}>{contact.phone}</div>}
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Cari Oluştur" subtitle="Temel bilgileri girin" wide id="create-account-modal">
        <form
          onSubmit={handleCreateAccount}
          style={{ padding: "10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
        >
          {/* Sol Kolon */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary.DEFAULT, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
              Firma ve İletişim Bilgileri
            </h4>
            <Input
              label="Firma Adı"
              value={createForm.company_name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, company_name: e.target.value }))}
              placeholder="Firma adı"
              required
            />
            <Select
              label="Hesap Tipi"
              value={createForm.account_type}
              onChange={(value) => setCreateForm((prev) => ({ ...prev, account_type: String(value) }))}
              options={accountTypeOptions}
            />
            <Input
              label="Telefon"
              value={createForm.phone}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="05XX XXX XX XX"
            />
            <Input
              type="email"
              label="E-posta"
              value={createForm.email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="ornek@firma.com"
            />
          </div>

          {/* Sağ Kolon */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary.DEFAULT, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
              Mali ve Bölgesel Bilgiler
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="Vergi No"
                value={createForm.tax_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, tax_id: e.target.value }))}
                placeholder="VKN veya TC"
              />
              <Input
                label="Vergi Dairesi"
                value={createForm.tax_office}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, tax_office: e.target.value }))}
                placeholder="Daire adı"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="Plaka Birim Fiyat (TL)"
                type="number"
                value={createForm.plaka_birim_fiyat}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, plaka_birim_fiyat: e.target.value }))}
                placeholder="Ör: 450"
              />
              <Input
                label="Bant Metre Fiyat (TL)"
                type="number"
                value={createForm.bant_metre_fiyat}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, bant_metre_fiyat: e.target.value }))}
                placeholder="Ör: 12"
              />
            </div>
            <Input
              label="Adres"
              value={createForm.address}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Açık adres"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="İl"
                value={createForm.city}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Şehir"
              />
              <Input
                label="İlçe"
                value={createForm.district}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, district: e.target.value }))}
                placeholder="İlçe"
              />
            </div>
          </div>

          {createError && <div style={{ gridColumn: "1 / -1", color: COLORS.error.DEFAULT, fontSize: 13 }}>{createError}</div>}

          {/* Alt Kısım - Butonlar */}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px", paddingTop: "16px", borderTop: `1px solid ${COLORS.border}` }}>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="primary" disabled={creating} style={{ minWidth: 120 }}>
              {creating ? "Kaydediliyor..." : "Cari Kartı Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Placeholder tabs for now
export function OpportunitiesTab() {
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOpportunity, setNewOpportunity] = useState({
    title: '',
    account_id: '',
    stage: 'PROSPECTING' as string,
    amount: 0,
    expected_close_date: ''
  });

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const data = await crmService.listOpportunities();
      setOpportunities(data);
    } catch (err) {
      console.error('Fırsatlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await crmService.createOpportunity({ title: newOpportunity.title, account_id: newOpportunity.account_id, stage: newOpportunity.stage as OpportunityStage, amount: newOpportunity.amount, expected_close_date: newOpportunity.expected_close_date });
      setCreateOpen(false);
      loadOpportunities();
      setNewOpportunity({ title: '', account_id: '', stage: 'PROSPECTING' as string, amount: 0, expected_close_date: '' });
    } catch (err) {
      console.error('Fırsat oluşturma hatası:', err);
    }
  }

  async function handleConvertToOrder(oppId: string) {
    try {
      setConverting(oppId);
      await crmService.convertToOrder(oppId);
      loadOpportunities();
    } catch (err) {
      console.error('Siparişe dönüştürme hatası:', err);
    } finally {
      setConverting(null);
    }
  }

  const stageColors: Record<string, string> = {
    PROSPECTING: COLORS.muted,
    QUALIFICATION: COLORS.info.DEFAULT,
    PROPOSAL: COLORS.warning.DEFAULT,
    NEGOTIATION: COLORS.accent.DEFAULT,
    CLOSED_WON: COLORS.success.DEFAULT,
    CLOSED_LOST: COLORS.error.DEFAULT
  };

  if (loading) return <Card title="Fırsat Pipeline"><div style={{ padding: 20 }}>Yükleniyor...</div></Card>;

  return (
    <>
      <Card
        title="Fırsat Pipeline"
        subtitle={`${opportunities.length} aktif fırsat`}
        actions={<Button onClick={() => setCreateOpen(true)}>+ Yeni Fırsat</Button>}
      >
        {opportunities.length === 0 ? (
          <div style={{ padding: "20px", color: COLORS.muted }}>Henüz fırsat bulunmuyor.</div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {opportunities.map(opp => (
              <div key={opp.id} style={{
                padding: "16px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                borderLeft: `4px solid ${stageColors[opp.stage] || COLORS.muted}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: COLORS.text }}>{opp.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{opp.account?.companyName}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: COLORS.primary.DEFAULT }}>₺{(opp.amount ?? 0).toLocaleString()}</div>
                      <Badge style={{ background: stageColors[opp.stage] }}>{opp.stage}</Badge>
                    </div>
                    {opp.stage !== "CLOSED_WON" && opp.stage !== "CLOSED_LOST" && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={converting === opp.id}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleConvertToOrder(opp.id); }}
                      >
                        {converting === opp.id ? "..." : "Siparişe Dönüştür"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Fırsat Oluştur">
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "16px" }}>
          <Input
            label="Fırsat Adı"
            value={newOpportunity.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpportunity(p => ({ ...p, title: e.target.value }))}
            required
          />
          <Input
            label="Değer (₺)"
            type="number"
            value={newOpportunity.amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpportunity(p => ({ ...p, amount: Number(e.target.value) }))}
            required
          />
          <Select
            label="Aşama"
            value={newOpportunity.stage}
            onChange={(val: string | number) => setNewOpportunity(p => ({ ...p, stage: String(val) }))}
            options={[
              { value: 'PROSPECTING', label: 'Araştırma' },
              { value: 'QUALIFICATION', label: 'Değerlendirme' },
              { value: 'PROPOSAL', label: 'Teklif' },
              { value: 'NEGOTIATION', label: 'Müzakere' },
              { value: 'CLOSED_WON', label: 'Kazanıldı' },
              { value: 'CLOSED_LOST', label: 'Kaybedildi' }
            ]}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Vazgeç</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function QuotesTab() {
  const [quotes, setQuotes] = useState<CRMQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    account_id: '',
    title: '',
    tax_rate: 20,
    discount_rate: 0,
    notes: '',
  });

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      setLoading(true);
      const data = await crmService.listQuotes();
      setQuotes(data);
    } catch (err) {
      console.error('Teklifler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateQuote(e: FormEvent) {
    e.preventDefault();
    try {
      const payload: QuoteInput = {
        account_id: newQuote.account_id,
        title: newQuote.title,
        tax_rate: newQuote.tax_rate,
        discount_rate: newQuote.discount_rate,
        notes: newQuote.notes || undefined,
        lines: [],
      };
      await crmService.createQuote(payload);
      setCreateOpen(false);
      setNewQuote({ account_id: '', title: '', tax_rate: 20, discount_rate: 0, notes: '' });
      loadQuotes();
    } catch (err) {
      console.error('Teklif oluşturma hatası:', err);
    }
  }

  const statusColors: Record<string, string> = {
    DRAFT: COLORS.muted,
    SENT: COLORS.info.DEFAULT,
    ACCEPTED: COLORS.success.DEFAULT,
    REJECTED: COLORS.error.DEFAULT,
    EXPIRED: COLORS.warning.DEFAULT
  };

  if (loading) return <Card title="Teklifler"><div style={{ padding: 20 }}>Yükleniyor...</div></Card>;

  return (
    <>
      <Card
        title="Teklifler"
        subtitle={`${quotes.length} teklif`}
        actions={<Button onClick={() => setCreateOpen(true)}>+ Yeni Teklif</Button>}
      >
        {quotes.length === 0 ? (
          <div style={{ padding: "20px", color: COLORS.muted }}>Henüz teklif bulunmuyor.</div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {quotes.map(quote => (
              <div key={quote.id} style={{
                padding: "16px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                borderLeft: `4px solid ${statusColors[quote.status] || COLORS.muted}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: COLORS.text }}>{quote.quoteNumber}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{quote.accountId}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: COLORS.primary.DEFAULT }}>₺{(quote.total ?? 0).toLocaleString()}</div>
                    <Badge style={{ background: statusColors[quote.status] }}>{quote.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Teklif Oluştur">
        <form onSubmit={handleCreateQuote} style={{ display: "grid", gap: "16px" }}>
          <Input
            label="Teklif Başlığı"
            value={newQuote.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuote(p => ({ ...p, title: e.target.value }))}
            required
          />
          <Input
            label="Hesap ID"
            value={newQuote.account_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuote(p => ({ ...p, account_id: e.target.value }))}
            required
          />
          <Input
            label="KDV Oranı (%)"
            type="number"
            value={newQuote.tax_rate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuote(p => ({ ...p, tax_rate: Number(e.target.value) }))}
          />
          <Input
            label="İndirim Oranı (%)"
            type="number"
            value={newQuote.discount_rate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuote(p => ({ ...p, discount_rate: Number(e.target.value) }))}
          />
          <Input
            label="Notlar"
            value={newQuote.notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuote(p => ({ ...p, notes: e.target.value }))}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Vazgeç</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function SyncHealthTab() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    try {
      setLoading(true);
      const data = await integrationService.getHealth();
      setHealth(data);
    } catch (err) {
      console.error("Sağlık verisi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  if (loading) {
    return (
      <Card title="Yükleniyor...">
        <div style={{ padding: "40px", textAlign: "center", color: COLORS.muted }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
          Senkron durumu yükleniyor...
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Senkron Durumu"
      subtitle="Mikro ERP bağlantı sağlığı"
      actions={
        <Button variant="ghost" size="sm" onClick={() => void loadHealth()}>
          ↻ Yenile
        </Button>
      }
    >
      <div style={{ padding: "12px 0" }}>
        <Badge
          variant={
            health?.status === "HEALTHY"
              ? "success"
              : health?.status === "DEGRADED"
                ? "warning"
                : "danger"
          }
        >
          {health?.status || "BİLİNMEYEN"}
        </Badge>
      </div>
    </Card>
  );
}

export function ErrorsTab() {
  const [errors, setErrors] = useState<IntegrationError[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadErrors();
  }, []);

  async function loadErrors() {
    try {
      setLoading(true);
      const data = await integrationService.listErrors();
      setErrors(data);
    } catch (err) {
      console.error('Hatalar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Card title="Entegrasyon Hataları"><div style={{ padding: 20 }}>Yükleniyor...</div></Card>;

  return (
    <Card title="Entegrasyon Hataları" subtitle={`${errors.length} hata`}>
      {errors.length === 0 ? (
        <div style={{ padding: "20px", color: COLORS.muted }}>Henüz hata kaydı bulunmuyor.</div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {errors.map((err, idx) => (
            <div key={idx} style={{
              padding: "16px",
              border: `1px solid ${COLORS.error.DEFAULT}30`,
              borderRadius: RADIUS.md,
              background: `${COLORS.error.DEFAULT}08`
            }}>
              <div style={{ fontWeight: 600, color: COLORS.error.DEFAULT }}>{err.errorCode}</div>
              <div style={{ fontSize: 13, color: COLORS.text, marginTop: 4 }}>{err.errorMessage}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
                {new Date(err.createdAt).toLocaleString('tr-TR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AuditTab() {
  const [audits, setAudits] = useState<IntegrationAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudits();
  }, []);

  async function loadAudits() {
    try {
      setLoading(true);
      const data = await integrationService.listAudit();
      setAudits(data);
    } catch (err) {
      console.error('İşlem geçmişi yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Card title="İşlem Geçmişi"><div style={{ padding: 20 }}>Yükleniyor...</div></Card>;

  return (
    <Card title="İşlem Geçmişi" subtitle={`${audits.length} kayıt`}>
      {audits.length === 0 ? (
        <div style={{ padding: "20px", color: COLORS.muted }}>Henüz işlem kaydı bulunmuyor.</div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {audits.map((audit, idx) => (
            <div key={idx} style={{
              padding: "16px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600, color: COLORS.text }}>{audit.action}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>
                  {new Date(audit.createdAt).toLocaleString('tr-TR')}
                </div>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                {audit.entityType}: {audit.entityId}
              </div>
              {audit.oldValue && (
                <div style={{ fontSize: 12, color: COLORS.text, marginTop: 8, padding: 8, background: `${COLORS.bg.main}`, borderRadius: RADIUS.sm }}>
                  {JSON.stringify(audit.oldValue)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
