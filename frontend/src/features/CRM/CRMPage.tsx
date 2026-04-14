import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "../../components/Shared";
import { COLORS, RADIUS, Z_INDEX, primaryRgba } from "../../components/Shared/constants";
import {
  crmService,
  type CRMAccount,
  type CRMContact,
  type CRMOpportunity,
  type CRMQuote,
  type CRMStats,
  OpportunityStage,
} from "../../services/crmService";
import {
  integrationService,
  type HealthStatus,
  type IntegrationError,
  type IntegrationAudit,
  type EntityMap,
  type OutboxItem,
} from "../../services/integrationService";
import { navigateToAppPage } from "../../utils/appNavigation";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "20px" }}>
      {/* Pipeline Stats */}
      <Card title="Pipeline Değeri" subtitle="Toplam fırsat değeri">
        <div style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.primary, marginBottom: "8px" }}>
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
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.success, marginBottom: "8px" }}>
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
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.warning, marginBottom: "8px" }}>
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
                <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.primary }}>{count}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Accounts Tab ──
interface AccountsTabProps {
  openCreateOnMount?: boolean;
  onCreateOpenHandled?: () => void;
}

export function AccountsTab({ openCreateOnMount = false, onCreateOpenHandled }: AccountsTabProps = {}) {
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CRMAccount | null>(null);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [entityMaps, setEntityMaps] = useState<EntityMap[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filter state
  const [filterAccountType, setFilterAccountType] = useState<string | undefined>(undefined);
  const [filterCity, setFilterCity] = useState("");
  const [filterMikroDurum, setFilterMikroDurum] = useState<boolean | undefined>(undefined);
  const [showPasifler, setShowPasifler] = useState(false);
  const [accountTypeDropOpen, setAccountTypeDropOpen] = useState(false);
  const [mikroDropOpen, setMikroDropOpen] = useState(false);

  // Contact create state
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactCreating, setContactCreating] = useState(false);
  const [contactCreateError, setContactCreateError] = useState<string | null>(null);

  const initialContactForm = {
    first_name: "",
    last_name: "",
    title: "",
    department: "",
    phone: "",
    mobile: "",
    email: "",
    is_primary: false,
    notes: "",
  };
  const [contactForm, setContactForm] = useState(initialContactForm);

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
    plaka_birim_fiyat: "",
    bant_metre_fiyat: "",
    notes: "",
  };
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const deferredFilterCity = useDeferredValue(filterCity.trim());

  const accountFilters = useMemo(
    () => ({
      search: undefined,
      is_active: showPasifler ? undefined : true,
      account_type: filterAccountType,
      city: deferredFilterCity || undefined,
      has_mikro_cari_kod: filterMikroDurum,
    }),
    [deferredFilterCity, filterAccountType, filterMikroDurum, showPasifler],
  );

  const accountTypeOptions = [
    { value: "CORPORATE", label: "Kurumsal" },
    { value: "INDIVIDUAL", label: "Bireysel" },
  ];

  useEffect(() => {
    void loadAccounts(accountFilters);
  }, [accountFilters]);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setCreateError(null);
    setCreateOpen(true);
    onCreateOpenHandled?.();
  }, [openCreateOnMount, onCreateOpenHandled]);

  const loadAccounts = useCallback(async (params?: {
    search?: string;
    is_active?: boolean;
    account_type?: string;
    city?: string;
    has_mikro_cari_kod?: boolean;
  }) => {
    try {
      setLoading(true);
      const data = await crmService.listAccounts(params);
      setAccounts(data);
    } catch (err) {
      console.error("Cari hesaplar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  async function selectAccount(account: CRMAccount) {
    setSelectedAccount(account);
    try {
      const [cs, maps, outboxData] = await Promise.all([
        crmService.listContacts({ account_id: account.id }),
        integrationService.listEntityMaps({ entity_type: "ACCOUNT", internal_id: account.id }),
        integrationService.listOutbox({ entity_type: "ACCOUNT", entity_id: account.id }),
      ]);
      setContacts(cs);
      setEntityMaps(maps);
      setOutboxItems(outboxData);
    } catch (err) {
      console.error("Hesap detayı yüklenemedi:", err);
    }
  }

  async function handlePassiveAccount(accountId: string) {
    try {
      await crmService.deleteAccount(accountId);
      await loadAccounts(accountFilters);
    } catch (err) {
      console.error("Hesap pasife alınamadı:", err);
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
        credit_limit: Number(createForm.credit_limit),
        payment_term_days: Number(createForm.payment_term_days),
        plaka_birim_fiyat: Number(createForm.plaka_birim_fiyat),
        bant_metre_fiyat: Number(createForm.bant_metre_fiyat),
        notes: createForm.notes || undefined,
      };
      const created = await crmService.createAccount(payload);
      setAccounts((prev) => [created, ...prev]);
      setSelectedAccount(created);
      setContacts([]);
      setEntityMaps([]);
      setOutboxItems([]);
      setCreateForm(initialCreateForm);
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cari hesap oluşturulamadı.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    const firstName = contactForm.first_name.trim();
    if (!firstName) {
      setContactCreateError("Yetkili adı zorunludur.");
      return;
    }
    setContactCreating(true);
    setContactCreateError(null);
    try {
      const created = await crmService.createContact({
        account_id: selectedAccount.id,
        first_name: firstName,
        last_name: contactForm.last_name.trim(),
        title: contactForm.title.trim() || undefined,
        department: contactForm.department.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        mobile: contactForm.mobile.trim() || undefined,
        email: contactForm.email.trim().toLowerCase() || undefined,
        is_primary: contactForm.is_primary,
        notes: contactForm.notes.trim() || undefined,
      });
      setContacts((prev) => [...prev, created]);
      setContactForm(initialContactForm);
      setContactCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Yetkili oluşturulamadı.";
      setContactCreateError(message);
    } finally {
      setContactCreating(false);
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Button onClick={() => setAccountTypeDropOpen((v) => !v)}>Hesap Tipi Filtre</Button>
          {accountTypeDropOpen && (
            <div style={{ position: "absolute", zIndex: Z_INDEX.dropdown, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, top: "100%", left: 0, minWidth: 140 }}>
              <div onClick={() => { setFilterAccountType(undefined); setAccountTypeDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Tümü</div>
              <div onClick={() => { setFilterAccountType("CORPORATE"); setAccountTypeDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Kurumsal</div>
              <div onClick={() => { setFilterAccountType("INDIVIDUAL"); setAccountTypeDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Bireysel</div>
            </div>
          )}
        </div>
        <Input label="Sehir" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} placeholder="Şehir filtrele" />
        <div style={{ position: "relative" }}>
          <Button onClick={() => setMikroDropOpen((v) => !v)}>Mikro Durumu</Button>
          {mikroDropOpen && (
            <div style={{ position: "absolute", zIndex: Z_INDEX.dropdown, background: COLORS.bg.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, top: "100%", left: 0, minWidth: 160 }}>
              <div onClick={() => { setFilterMikroDurum(undefined); setMikroDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Tümü</div>
              <div onClick={() => { setFilterMikroDurum(true); setMikroDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Mikro eslesti</div>
              <div onClick={() => { setFilterMikroDurum(false); setMikroDropOpen(false); }} style={{ padding: "8px 12px", cursor: "pointer" }}>Mikro bekleyenler</div>
            </div>
          )}
        </div>
        <span onClick={() => setShowPasifler((v) => !v)} style={{ cursor: "pointer", fontSize: 13, color: showPasifler ? COLORS.primary : COLORS.muted, userSelect: "none" }}>
          Pasifleri goster
        </span>
      </div>

      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: COLORS.muted }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selectedAccount ? "1fr 1fr" : "1fr", gap: "20px" }}>
          {/* Accounts List */}
          <Card
            title="Cari Hesaplar"
            subtitle={`${accounts.length} hesap`}
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
                    onClick={() => void selectAccount(account)}
                    style={{
                      padding: "12px",
                      borderBottom: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                      background: selectedAccount?.id === account.id ? primaryRgba(0.05) : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{account.companyName}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>
                        {account.taxId && <span>VKN: {account.taxId}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        void handlePassiveAccount(account.id);
                      }}
                    >
                      Pasife Al
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Account Detail */}
          {selectedAccount && (
            <Card title={selectedAccount.companyName} subtitle="Cari Detayı">
              {/* Vergi ve Resmi Bilgiler */}
              <div style={{ marginBottom: 12 }}>
                <h5 style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: "0 0 6px" }}>Vergi ve Resmi Bilgiler</h5>
                {selectedAccount.taxId && <div style={{ fontSize: 13 }}>VKN: {selectedAccount.taxId}</div>}
                {selectedAccount.taxOffice && <div style={{ fontSize: 13 }}>Vergi Dairesi: {selectedAccount.taxOffice}</div>}
              </div>

              {/* Adresler */}
              <div style={{ marginBottom: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                <h5 style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: "0 0 6px" }}>Adresler</h5>
                {selectedAccount.address && <div style={{ fontSize: 13 }}>{selectedAccount.address}</div>}
                {selectedAccount.city && <div style={{ fontSize: 13 }}>{selectedAccount.city}</div>}
              </div>

              {/* Risk ve Limit */}
              <div style={{ marginBottom: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                <h5 style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: "0 0 6px" }}>Risk ve Limit</h5>
                {selectedAccount.plakaBirimFiyat != null && (
                  <div style={{ fontSize: 13 }}>Plaka: {selectedAccount.plakaBirimFiyat} TL/adet</div>
                )}
                {selectedAccount.bantMetreFiyat != null && (
                  <div style={{ fontSize: 13 }}>Bant: {selectedAccount.bantMetreFiyat} TL/m</div>
                )}
                {selectedAccount.paymentTermDays != null && (
                  <div style={{ fontSize: 13 }}>Vade: {selectedAccount.paymentTermDays} gün</div>
                )}
                {selectedAccount.creditLimit != null && (
                  <div style={{ fontSize: 13 }}>Kredi Limiti: {selectedAccount.creditLimit.toLocaleString("tr-TR")} TL</div>
                )}
              </div>

              {/* Cari Teknik Paneli */}
              <div style={{ marginBottom: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                <h5 style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: "0 0 6px" }}>Cari Teknik Paneli</h5>
                {entityMaps.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: COLORS.success, fontWeight: 600, marginBottom: 4 }}>Mikro eslesti</div>
                    {entityMaps.map((map) => (
                      <div key={map.id} style={{ fontSize: 12, color: COLORS.muted }}>{map.externalSystem} / {map.externalId}</div>
                    ))}
                  </div>
                )}
                {outboxItems.map((item) => (
                  <div key={item.id} style={{ fontSize: 12, marginBottom: 4 }}>
                    <Badge variant={item.status === "FAILED" ? "danger" : "success"}>{item.status}</Badge>
                    {item.errorMessage && <span style={{ marginLeft: 6, color: COLORS.muted }}>{item.errorMessage}</span>}
                  </div>
                ))}
              </div>

              {/* Contacts */}
              <div style={{ paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>Kişiler ({contacts.length})</h4>
                  <Button
                    size="sm"
                    onClick={() => {
                      setContactForm(initialContactForm);
                      setContactCreateError(null);
                      setContactCreateOpen(true);
                    }}
                  >
                    + Yeni Yetkili
                  </Button>
                </div>
                {contacts.length === 0 ? (
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Henüz kişi eklenmemiş</div>
                ) : (
                  contacts.map((contact) => (
                    <div key={contact.id} style={{ padding: "8px", background: COLORS.bg.surface, borderRadius: RADIUS.sm, marginBottom: "8px", fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: COLORS.text }}>
                        {contact.firstName} {contact.lastName}
                        {contact.isPrimary && <span style={{ marginLeft: "8px" }}><Badge variant="info">Birincil</Badge></span>}
                      </div>
                      {contact.title && <div style={{ fontSize: 12, color: COLORS.muted }}>{contact.title}</div>}
                      {contact.email && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: "4px" }}>{contact.email}</div>}
                      {contact.phone && <div style={{ fontSize: 12, color: COLORS.muted }}>{contact.phone}</div>}
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Account Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Cari Oluştur" subtitle="Temel bilgileri girin" wide id="create-account-modal">
        <form onSubmit={handleCreateAccount} style={{ padding: "10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
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
                label="Kredi Limiti"
                type="number"
                value={createForm.credit_limit}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, credit_limit: e.target.value }))}
                placeholder="Ör: 50000"
              />
              <Input
                label="Vade (Gun)"
                type="number"
                value={createForm.payment_term_days}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, payment_term_days: e.target.value }))}
                placeholder="Ör: 30"
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
          {createError && <div style={{ gridColumn: "1 / -1", color: COLORS.danger, fontSize: 13 }}>{createError}</div>}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px", paddingTop: "16px", borderTop: `1px solid ${COLORS.border}` }}>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={creating} style={{ minWidth: 120 }}>
              {creating ? "Kaydediliyor..." : "Cari Kartı Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Contact Modal */}
      <Modal open={contactCreateOpen} onClose={() => setContactCreateOpen(false)} title="Yeni Yetkili Oluştur" id="create-contact-modal">
        <form onSubmit={handleCreateContact} style={{ padding: "10px 0", display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Ad" value={contactForm.first_name} onChange={(e) => setContactForm((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="Ad" />
            <Input label="Soyad" value={contactForm.last_name} onChange={(e) => setContactForm((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="Soyad" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Unvan" value={contactForm.title} onChange={(e) => setContactForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Unvan" />
            <Input label="Departman" value={contactForm.department} onChange={(e) => setContactForm((prev) => ({ ...prev, department: e.target.value }))} placeholder="Departman" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Telefon" value={contactForm.phone} onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Sabit telefon" />
            <Input label="Mobil" value={contactForm.mobile} onChange={(e) => setContactForm((prev) => ({ ...prev, mobile: e.target.value }))} placeholder="Cep telefonu" />
          </div>
          <Input label="E-posta" type="email" value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="eposta@ornek.com" />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="contact-is-primary"
              checked={contactForm.is_primary}
              onChange={(e) => setContactForm((prev) => ({ ...prev, is_primary: e.target.checked }))}
            />
            <label htmlFor="contact-is-primary" style={{ fontSize: 13, cursor: "pointer" }}>Birincil yetkili olarak isaretle</label>
          </div>
          <Input label="Notlar" value={contactForm.notes} onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notlar" />
          {contactCreateError && <div style={{ color: COLORS.danger, fontSize: 13 }}>{contactCreateError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={() => setContactCreateOpen(false)}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={contactCreating}>
              {contactCreating ? "Kaydediliyor..." : "Yetkili Oluştur"}
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
    QUALIFICATION: COLORS.primary,
    PROPOSAL: COLORS.warning,
    NEGOTIATION: COLORS.accent,
    CLOSED_WON: COLORS.success,
    CLOSED_LOST: COLORS.danger
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
                      <div style={{ fontWeight: 700, color: COLORS.primary }}>₺{(opp.amount ?? 0).toLocaleString()}</div>
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
  const [quoteLoadError, setQuoteLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void crmService
      .listQuotes()
      .then((data) => {
        if (!active) return;
        setQuotes(data);
        setQuoteLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setQuoteLoadError("Teklifler yüklenemedi");
        console.error("Teklifler yüklenemedi:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Teklif Yuzeyi Tekillestirildi</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>Mükerrer teklif yüzeyi kapatildi</div>
        <Button onClick={() => navigateToAppPage(ORDER_ROUTE_META.quoteForm.page, "crm-quotes-tab")}>
          {"Teklif Fisi'ni Ac"}
        </Button>
      </div>
      {quoteLoadError && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: RADIUS.md, border: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.08)", color: "#fca5a5", fontSize: 13 }}>
          {quoteLoadError}
        </div>
      )}
      {!quoteLoadError && quotes.length === 0 && (
        <div style={{ marginBottom: 16, color: COLORS.muted, fontSize: 13, textAlign: "center" }}>
          Henüz teklif bulunmuyor.
        </div>
      )}
      {quotes.map((q) => (
        <div key={q.id} style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{q.quoteNumber}</span>
            {q.accountName && <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>{q.accountName}</span>}
          </div>
          <Badge variant={q.status === "ACCEPTED" ? "success" : q.status === "REJECTED" ? "danger" : "secondary"}>
            {q.status}
          </Badge>
        </div>
      ))}
    </div>
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
              border: `1px solid ${COLORS.danger}30`,
              borderRadius: RADIUS.md,
              background: `${COLORS.danger}08`
            }}>
              <div style={{ fontWeight: 600, color: COLORS.danger }}>{err.errorCode}</div>
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


