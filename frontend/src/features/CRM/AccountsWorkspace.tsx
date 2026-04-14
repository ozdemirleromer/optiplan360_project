import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { Upload } from "lucide-react";
import { Badge, Button, Card, Input, IntegrationReadonlyPanel, Modal, Select } from "../../components/Shared";
import { notificationHelpers } from "../../stores/notificationStore";
import { COLORS, RADIUS, primaryRgba } from "../../components/Shared/constants";
import { crmService, type AccountInput, type ContactInput, type CRMAccount, type CRMContact, type CRMAddress } from "../../services/crmService";
import { apiRequest } from "../../services/apiClient";
import { ADDRESS_TYPE_OPTIONS, describeAddressType, type AddressType } from "./types/addressTypes";

interface AccountsWorkspaceProps {
  openCreateOnMount?: boolean;
  onCreateOpenHandled?: () => void;
}

type MikroFilterState = "ALL" | "ONLY_MAPPED" | "ONLY_UNMAPPED";

interface AccountFilterState {
  search: string;
  accountType: string;
  city: string;
  mikroState: MikroFilterState;
  showInactive: boolean;
}

interface AccountFormState {
  company_name: string;
  account_type: string;
  tax_id: string;
  tax_id_type: string;
  tax_office: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  country: string;
  website: string;
  industry: string;
  credit_limit: string;
  payment_term_days: string;
  dealer_type: string;
  installation_service_available: boolean;
  delivery_days: string;
  warehouse_location: string;
  preferred_materials: string;
  preferred_colors: string;
  min_order_amount: string;
  discount_rate: string;
  tags: string;
  plaka_birim_fiyat: string;
  bant_metre_fiyat: string;
  durum: string;
  is_active: boolean;
  vergi_tipi: string;
  mikro_cari_kod: string;
  notes: string;
  // Cari Kartı spec fields
  grup_kod: string;
  sektor_kod: string;
  bolge_kod: string;
  temsilci_kod: string;
  // Additional classification fields
  risk_seviyesi: string;
  odeme_tipi: string;
  teslimat_sikligi: string;
  ozel_kod: string;
}

interface AccountMetricCardProps {
  label: string;
  value: string;
  hint: string;
}

interface AccountSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

type AccountDetailTab = "general" | "commercial" | "operations" | "addresses" | "contacts" | "technical";

interface AccountFormModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  submitLabel: string;
  busyLabel: string;
  form: AccountFormState;
  setForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  modalId: string;
  /** Mikro Cari Kodu alanını göster (sadece düzenleme modunda) */
  showMikroCariKod?: boolean;
}

const sectionPanelStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: RADIUS.lg,
  border: `1px solid ${COLORS.border}`,
  background: '#242424',
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const detailLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const workspaceCardStyle: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
};

function getDenseTabButtonStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? primaryRgba(0.12) : '#242424',
    color: active ? COLORS.primary : COLORS.text,
    borderRadius: RADIUS.md,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 36,
  };
}

function getAccountListItemStyle(isSelected: boolean): CSSProperties {
  return {
    padding: "10px 12px",
    cursor: "pointer",
    background: isSelected ? primaryRgba(0.12) : '#242424',
    border: `1px solid ${isSelected ? COLORS.primary : COLORS.border}`,
    borderRadius: RADIUS.md,
    boxShadow: isSelected ? `0 0 0 1px ${primaryRgba(0.12)}` : "0 8px 18px rgba(15, 23, 42, 0.04)",
    display: "grid",
    gap: 8,
    minHeight: 112,
  };
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: "CORPORATE", label: "Kurumsal" },
  { value: "INDIVIDUAL", label: "Bireysel" },
];

const ACCOUNT_TYPE_FILTER_OPTIONS = [{ value: "ALL", label: "Tüm Tipler" }, ...ACCOUNT_TYPE_OPTIONS];

const DEALER_TYPE_OPTIONS = [
  { value: "", label: "Seçilmedi" },
  { value: "DEALER", label: "Bayi" },
  { value: "B2B", label: "B2B" },
  { value: "B2C", label: "B2C" },
  { value: "PROJECT", label: "Proje" },
  { value: "MANUFACTURER", label: "Uretici" },
];

const MIKRO_FILTER_OPTIONS = [
  { value: "ALL", label: "Tüm kayıtlar" },
  { value: "ONLY_MAPPED", label: "Mikro Eşleşenler" },
  { value: "ONLY_UNMAPPED", label: "Mikro bekleyenler" },
];

const TAX_ID_TYPE_OPTIONS = [
  { value: "VERGI_NO", label: "Vergi No" },
  { value: "TCKN", label: "T.C. Kimlik No" },
];

const VERGI_TIPI_OPTIONS = [
  { value: "KDV_TABI", label: "KDV Tabi" },
  { value: "KDV_MUAF", label: "KDV Muaf" },
  { value: "TEVKIFAT", label: "Tevkifatlı" },
];

const DURUM_OPTIONS = [
  { value: "TASLAK", label: "Taslak" },
  { value: "AKTIF", label: "Aktif" },
  { value: "PASIF", label: "Pasif" },
  { value: "BLOKE", label: "Bloke" },
  { value: "DOGRULAMA_BEKLIYOR", label: "Doğrulama Bekliyor" },
  { value: "ARSIV", label: "Arşiv" },
];

// Risk seviyesi seçenekleri
const RISK_SEVIYESI_OPTIONS = [
  { value: "", label: "Seçilmedi" },
  { value: "DUSUK", label: "Düşük" },
  { value: "ORTA", label: "Orta" },
  { value: "YUKSEK", label: "Yüksek" },
];

// Ödeme tipi seçenekleri
const ODEME_TIPI_OPTIONS = [
  { value: "", label: "Seçilmedi" },
  { value: "NAKIT", label: "Nakit" },
  { value: "KREDI", label: "Kredi" },
  { value: "CEK", label: "Çek" },
  { value: "HAVALE", label: "Havale" },
];

// Teslimat sıklığı seçenekleri
const TESLIMAT_SIKLIGI_OPTIONS = [
  { value: "", label: "Seçilmedi" },
  { value: "GUNLUK", label: "Günlük" },
  { value: "HAFTALIK", label: "Haftalık" },
  { value: "AYLIK", label: "Aylık" },
  { value: "AYDA_2", label: "2 Ayda Bir" },
  { value: "3_AYDA_BIR", label: "3 Ayda Bir" },
];

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  company_name: "",
  account_type: "CORPORATE",
  tax_id: "",
  tax_id_type: "VERGI_NO",
  tax_office: "",
  vergi_tipi: "KDV_TABI",
  phone: "",
  email: "",
  address: "",
  city: "",
  district: "",
  country: "Türkiye",
  website: "",
  industry: "",
  credit_limit: "",
  payment_term_days: "",
  dealer_type: "",
  installation_service_available: false,
  delivery_days: "",
  warehouse_location: "",
  preferred_materials: "",
  preferred_colors: "",
  min_order_amount: "",
  discount_rate: "",
  tags: "",
  plaka_birim_fiyat: "",
  bant_metre_fiyat: "",
  durum: "AKTIF",
  is_active: true,
  mikro_cari_kod: "",
  notes: "",
  // Cari Kartı spec fields
  grup_kod: "",
  sektor_kod: "",
  bolge_kod: "",
  temsilci_kod: "",
  // Additional classification fields
  risk_seviyesi: "",
  odeme_tipi: "",
  teslimat_sikligi: "",
  ozel_kod: "",
};

const EMPTY_CONTACT_FORM = {
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

function AccountDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <span style={detailLabelStyle}>{label}</span>
      <span style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function parseOptionalNumberInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return Number(value);
}

function parseOptionalIntegerInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return Number.parseInt(value, 10);
}

function splitTagValues(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function describeAccountType(value?: string) {
  if (value === "INDIVIDUAL") return "Bireysel";
  if (value === "CORPORATE") return "Kurumsal";
  return value ?? "Tanimsiz";
}

function describeDealerType(value?: string) {
  if (value === "DEALER") return "Bayi";
  if (value === "B2B") return "B2B";
  if (value === "B2C") return "B2C";
  if (value === "PROJECT") return "Proje";
  if (value === "MANUFACTURER") return "Uretici";
  return value ?? "Yok";
}

function formatCurrencyValue(value?: number | null) {
  if (value == null) return "Yok";
  return `₺${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

function formatNumberValue(value?: number | null, suffix = "") {
  if (value == null) return "Yok";
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}${suffix}`;
}

function createAccountFormState(account?: CRMAccount): AccountFormState {
  if (!account) return { ...EMPTY_ACCOUNT_FORM };

  return {
    company_name: account.companyName ?? "",
    account_type: account.accountType ?? "CORPORATE",
    tax_id: account.taxId ?? "",
    tax_id_type: (account as unknown as Record<string, unknown>).taxIdType as string ?? "VERGI_NO",
    tax_office: account.taxOffice ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    address: account.address ?? "",
    city: account.city ?? "",
    district: account.district ?? "",
    country: (account as unknown as Record<string, unknown>).country as string ?? "Türkiye",
    website: account.website ?? "",
    industry: account.industry ?? "",
    credit_limit: account.creditLimit != null ? String(account.creditLimit) : "",
    payment_term_days: account.paymentTermDays != null ? String(account.paymentTermDays) : "",
    dealer_type: account.dealerType ?? "",
    installation_service_available: account.installationServiceAvailable ?? false,
    delivery_days: account.deliveryDays != null ? String(account.deliveryDays) : "",
    warehouse_location: account.warehouseLocation ?? "",
    preferred_materials: account.preferredMaterials ?? "",
    preferred_colors: account.preferredColors ?? "",
    min_order_amount: account.minOrderAmount != null ? String(account.minOrderAmount) : "",
    discount_rate: account.discountRate != null ? String(account.discountRate) : "",
    tags: account.tags ?? "",
    plaka_birim_fiyat: account.plakaBirimFiyat != null ? String(account.plakaBirimFiyat) : "",
    bant_metre_fiyat: account.bantMetreFiyat != null ? String(account.bantMetreFiyat) : "",
    durum: account.isActive ? "AKTIF" : "PASIF",
    is_active: account.isActive ?? true,
    vergi_tipi: "KDV_TABI",
    mikro_cari_kod: account.mikroCariKod ?? "",
    notes: account.notes ?? "",
    // Cari Kartı spec fields
    grup_kod: (account as unknown as Record<string, unknown>).grupKod as string ?? "",
    sektor_kod: (account as unknown as Record<string, unknown>).sektorKod as string ?? "",
    bolge_kod: (account as unknown as Record<string, unknown>).bolgeKod as string ?? "",
    temsilci_kod: (account as unknown as Record<string, unknown>).temsilciKod as string ?? "",
    // Additional classification fields
    risk_seviyesi: (account as unknown as Record<string, unknown>).riskSeviyesi as string ?? "",
    odeme_tipi: (account as unknown as Record<string, unknown>).odemeTipi as string ?? "",
    teslimat_sikligi: (account as unknown as Record<string, unknown>).teslimatSikligi as string ?? "",
    ozel_kod: (account as unknown as Record<string, unknown>).ozelKod as string ?? "",
  };
}

function parseAccountPayload(form: AccountFormState, mode: "create" | "edit") {
  const companyName = form.company_name.trim();
  const creditLimit = parseOptionalNumberInput(form.credit_limit);
  const paymentTermDays = parseOptionalIntegerInput(form.payment_term_days);
  const deliveryDays = parseOptionalIntegerInput(form.delivery_days);
  const minOrderAmount = parseOptionalNumberInput(form.min_order_amount);
  const discountRate = parseOptionalNumberInput(form.discount_rate);
  const plakaBirimFiyat = parseOptionalNumberInput(form.plaka_birim_fiyat);
  const bantMetreFiyat = parseOptionalNumberInput(form.bant_metre_fiyat);

  if (!companyName) {
    return { payload: {}, error: "Firma adı zorunludur." };
  }

  const numericRules = [
    { label: "Kredi limiti", value: creditLimit },
    { label: "Minimum sipariş tutarı", value: minOrderAmount },
    { label: "Plaka birim fiyatı", value: plakaBirimFiyat },
    { label: "Bant metre fiyatı", value: bantMetreFiyat },
  ];

  for (const rule of numericRules) {
    if (rule.value === undefined) continue;
    if (Number.isNaN(rule.value)) {
      return { payload: {}, error: `${rule.label} sayisal olmalidir.` };
    }
    if (rule.value < 0) {
      return { payload: {}, error: `${rule.label} negatif olamaz.` };
    }
  }

  const integerRules = [
    { label: "Vade günü", value: paymentTermDays },
    { label: "Teslim günü", value: deliveryDays },
  ];

  for (const rule of integerRules) {
    if (rule.value === undefined) continue;
    if (Number.isNaN(rule.value)) {
      return { payload: {}, error: `${rule.label} sayisal olmalidir.` };
    }
    if (rule.value < 0) {
      return { payload: {}, error: `${rule.label} negatif olamaz.` };
    }
  }

  if (discountRate !== undefined) {
    if (Number.isNaN(discountRate)) {
      return { payload: {}, error: "İskonto oranı sayısal olmalıdır." };
    }
    if (discountRate < 0 || discountRate > 100) {
      return { payload: {}, error: "İskonto oranı 0 ile 100 arasında olmalıdır." };
    }
  }

  const validation = buildAccountValidation(form);
  const firstValidationError = Object.values(validation).find(Boolean);
  if (firstValidationError) {
    return { payload: {}, error: firstValidationError };
  }

  const optionalString = (value: string, clearOnEdit = true) => {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return mode === "edit" && clearOnEdit ? null : undefined;
  };

  const optionalNumber = (value: number | undefined, clearOnEdit = true) => {
    if (value === undefined) {
      return mode === "edit" && clearOnEdit ? null : undefined;
    }
    return value;
  };

  const payload: Partial<AccountInput> & Record<string, unknown> = {
    company_name: companyName,
    account_type: form.account_type,
    tax_id: optionalString(form.tax_id),
    tax_id_type: form.tax_id_type || "VERGI_NO",
    tax_office: optionalString(form.tax_office),
    phone: optionalString(form.phone),
    email: optionalString(form.email),
    address: optionalString(form.address),
    city: optionalString(form.city),
    district: optionalString(form.district),
    country: form.country.trim() || "Türkiye",
    website: optionalString(form.website),
    industry: optionalString(form.industry),
    credit_limit: creditLimit,
    payment_term_days: paymentTermDays,
    dealer_type: form.dealer_type || (mode === "edit" ? null : undefined),
    installation_service_available: form.installation_service_available,
    delivery_days: optionalNumber(deliveryDays),
    warehouse_location: optionalString(form.warehouse_location),
    preferred_materials: optionalString(form.preferred_materials),
    preferred_colors: optionalString(form.preferred_colors),
    min_order_amount: optionalNumber(minOrderAmount),
    discount_rate: discountRate,
    tags: optionalString(form.tags),
    plaka_birim_fiyat: plakaBirimFiyat,
    bant_metre_fiyat: bantMetreFiyat,
    is_active: form.durum === "AKTIF",
    mikro_cari_kod: optionalString(form.mikro_cari_kod),
    notes: optionalString(form.notes),
    // Cari Kartı spec fields
    grup_kod: optionalString(form.grup_kod),
    sektor_kod: optionalString(form.sektor_kod),
    bolge_kod: optionalString(form.bolge_kod),
    temsilci_kod: optionalString(form.temsilci_kod),
    // Additional classification fields
    risk_seviyesi: optionalString(form.risk_seviyesi),
    odeme_tipi: optionalString(form.odeme_tipi),
    teslimat_sikligi: optionalString(form.teslimat_sikligi),
    ozel_kod: optionalString(form.ozel_kod),
  };

  return {
    payload: Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)),
    error: null,
  };
}

function parseContactPayload(accountId: string, form: typeof EMPTY_CONTACT_FORM) {
  const firstName = form.first_name.trim();
  const lastName = form.last_name.trim();

  if (!firstName) {
    return { payload: null, error: "Yetkili adı zorunludur." };
  }

  if (!lastName) {
    return { payload: null, error: "Yetkili soyadı zorunludur." };
  }

  const optionalString = (value: string) => {
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  const email = optionalString(form.email);

  const payload: ContactInput = {
    account_id: accountId,
    first_name: firstName,
    last_name: lastName,
    title: optionalString(form.title),
    department: optionalString(form.department),
    phone: optionalString(form.phone),
    mobile: optionalString(form.mobile),
    email: email?.toLowerCase(),
    is_primary: form.is_primary,
    notes: optionalString(form.notes),
  };

  return {
    payload,
    error: null,
  };
}

function AccountMetricCard({ label, value, hint }: AccountMetricCardProps) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        background: '#242424',
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        display: "grid",
        gap: 4,
      }}
    >
      <span style={detailLabelStyle}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>{value}</span>
      <span style={{ fontSize: 11, color: COLORS.muted }}>{hint}</span>
    </div>
  );
}

// Form validation interface
interface FormValidation {
  company_name?: string;
  account_type?: string;
  tax_id_type?: string;
  tax_id?: string;
  tax_office?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  credit_limit?: string;
  payment_term_days?: string;
  discount_rate?: string;
  grup_kod?: string;
  sektor_kod?: string;
  risk_seviyesi?: string;
  odeme_tipi?: string;
}

type AccountMandatoryFieldKey =
  | "company_name"
  | "account_type";

const ACCOUNT_MANDATORY_FIELDS: Array<{ key: AccountMandatoryFieldKey; label: string }> = [
  { key: "company_name", label: "Firma Adı" },
  { key: "account_type", label: "Hesap Tipi" },
];

const ACCOUNT_PROGRESS_OPTIONAL_FIELDS: Array<keyof AccountFormState> = [
  "phone",
  "email",
  "grup_kod",
  "sektor_kod",
  "risk_seviyesi",
  "odeme_tipi",
];

function isAccountFieldFilled(form: AccountFormState, field: keyof AccountFormState) {
  const value = form[field];
  if (typeof value == "boolean") {
    return value;
  }
  return String(value ?? "").trim() !== "";
}

function buildAccountValidation(form: AccountFormState): FormValidation {
  const errors: FormValidation = {};

  if (!form.company_name?.trim()) {
    errors.company_name = "Firma adı zorunludur";
  }

  if (!form.account_type) {
    errors.account_type = "Hesap tipi seçiniz";
  }

  const taxId = form.tax_id?.trim();
  if (taxId) {
    if (form.tax_id_type == "TCKN") {
      if (taxId.length != 11) {
        errors.tax_id = "TC Kimlik No 11 haneli olmalıdır";
      } else if (!/^[0-9]{11}$/.test(taxId)) {
        errors.tax_id = "TC Kimlik No sadece rakamlardan oluşmalıdır";
      }
    } else if (taxId.length != 10) {
      errors.tax_id = "Vergi No 10 haneli olmalıdır";
    } else if (!/^[0-9]{10}$/.test(taxId)) {
      errors.tax_id = "Vergi No sadece rakamlardan oluşmalıdır";
    }
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Geçerli bir e-posta adresi giriniz";
  }

  if (form.phone && !/^0[0-9]{10}$/.test(form.phone.replace(/\s/g, ""))) {
    errors.phone = "Telefon formatı: 05XX XXX XX XX";
  }

  if (form.credit_limit && parseFloat(form.credit_limit) < 0) {
    errors.credit_limit = "Kredi limiti negatif olamaz";
  }

  if (form.payment_term_days && parseInt(form.payment_term_days, 10) > 365) {
    errors.payment_term_days = "Vade günü 365 günden fazla olamaz";
  }

  if (
    form.discount_rate &&
    (parseFloat(form.discount_rate) < 0 || parseFloat(form.discount_rate) > 100)
  ) {
    errors.discount_rate = "İskonto oranı 0-100 arasında olmalıdır";
  }

  return errors;
}

function getAccountMandatorySummary(form: AccountFormState, validation: FormValidation) {
  const items = ACCOUNT_MANDATORY_FIELDS.map(({ key, label }) => ({
    key,
    label,
    filled: isAccountFieldFilled(form, key),
    error: validation[key],
  }));

  const completed = items.filter((item) => item.filled && !item.error).length;

  return {
    items,
    completed,
    remaining: items.length - completed,
  };
}

// Collapsible form section component
function FormSection({ 
  title, 
  expanded, 
  onToggle, 
  children,
  validationErrors = 0
}: { 
  title: string; 
  expanded: boolean; 
  onToggle: () => void; 
  children: ReactNode;
  validationErrors?: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 12, 
          padding: '10px 12px',
          backgroundColor: validationErrors > 0 ? '#2a1f1f' : '#242424',
          border: `1px solid ${validationErrors > 0 ? COLORS.danger : COLORS.border}`,
          borderRadius: RADIUS.md,
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{title}</span>
          {validationErrors > 0 && (
            <span style={{ 
              fontSize: 10, 
              backgroundColor: COLORS.danger, 
              color: 'white', 
              padding: '2px 6px', 
              borderRadius: 10, 
              fontWeight: 600 
            }}>
              {validationErrors} hata
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ 
          padding: '12px',
          borderLeft: `1px solid ${validationErrors > 0 ? COLORS.danger : COLORS.border}`,
          borderRight: `1px solid ${validationErrors > 0 ? COLORS.danger : COLORS.border}`,
          borderBottom: `1px solid ${validationErrors > 0 ? COLORS.danger : COLORS.border}`,
          borderRadius: `0 0 ${RADIUS.md} ${RADIUS.md}`,
          backgroundColor: validationErrors > 0 ? 'rgba(239, 68, 68, 0.08)' : '#1a1a1a'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Enhanced Input component with validation feedback
function EnhancedInput({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder, 
  required = false, 
  error, 
  type = 'text', 
  hint 
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  
  const showError = touched && error;
  const isValid = touched && !error && value.trim() !== '';
  
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label 
        htmlFor={id} 
        style={{ 
          fontSize: 12, 
          fontWeight: 500, 
          color: COLORS.text,
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        {label}
        {required && <span style={{ color: COLORS.danger }}>*</span>}
        {isValid && <span style={{ color: COLORS.success, fontSize: 10 }}></span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: RADIUS.md,
            border: `2px solid ${showError ? COLORS.danger : focused ? COLORS.primary : COLORS.border}`,
            backgroundColor: '#1a1a1a',
            color: COLORS.text,
            fontSize: 13,
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: focused ? `0 0 0 3px ${primaryRgba(0.1)}` : 'none'
          }}
        />
        {showError && (
          <div style={{ 
            position: 'absolute',
            top: '50%',
            right: 12,
            transform: 'translateY(-50%)',
            color: COLORS.danger,
            fontSize: 14,
            fontWeight: 600
          }}>
            !
          </div>
        )}
      </div>
      {showError && (
        <div style={{ 
          fontSize: 11, 
          color: COLORS.danger, 
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <span style={{ fontSize: 10 }}>!</span>
          {error}
        </div>
      )}
      {hint && !showError && (
        <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function AccountSection({ title, action, children }: AccountSectionProps) {
  return (
    <div style={sectionPanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{title}</span>
        {action}
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function AccountBlockingNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      style={{
        padding: "10px 12px",
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.warning}`,
        background: `${COLORS.warning}10`,
        color: COLORS.muted,
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

function AccountFormModal({
  open,
  title,
  subtitle,
  submitLabel,
  busyLabel,
  form,
  setForm,
  error,
  busy,
  onClose,
  onSubmit,
  modalId,
  showMikroCariKod = false,
}: AccountFormModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSections, setExpandedSections] = useState(new Set(['genel']));
  const [formProgress, setFormProgress] = useState(0);
  const [validation, setValidation] = useState<FormValidation>({});
  
  const taxIdLabel = form.tax_id_type === "TCKN" ? "T.C. Kimlik No" : "Vergi No";
  const mandatorySummary = getAccountMandatorySummary(form, validation);
  const hasMandatoryErrors = mandatorySummary.items.some((item) => item.error);
  
  const totalSteps = 6;
  
  // Calculate form progress
  useEffect(() => {
    const filledRequired = ACCOUNT_MANDATORY_FIELDS.filter(({ key }) => isAccountFieldFilled(form, key));
    const filledOptional = ACCOUNT_PROGRESS_OPTIONAL_FIELDS.filter((field) => isAccountFieldFilled(form, field));
    
    const requiredProgress = (filledRequired.length / ACCOUNT_MANDATORY_FIELDS.length) * 70;
    const optionalProgress = (filledOptional.length / ACCOUNT_PROGRESS_OPTIONAL_FIELDS.length) * 30;
    const totalProgress = Math.round(requiredProgress + optionalProgress);
    
    setFormProgress(Math.min(100, totalProgress));
  }, [form]);
  
  // Real-time validation
  useEffect(() => {
    setValidation(buildAccountValidation(form));
  }, [form]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const saveTimer = window.setTimeout(() => {
      try {
        const formData = {
          form,
          currentStep,
          expandedSections: Array.from(expandedSections),
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(`${modalId}:draft`, JSON.stringify(formData));
      } catch (error) {
        console.warn("Form verisi kaydedilemedi:", error);
      }
    }, 1000);

    return () => window.clearTimeout(saveTimer);
  }, [open, form, currentStep, expandedSections, modalId]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(`${modalId}:draft`);
      if (!saved || form.company_name.trim()) return;

      const formData = JSON.parse(saved) as {
        form?: AccountFormState;
        currentStep?: number;
        expandedSections?: string[];
        timestamp?: string;
      };
      if (!formData.timestamp) return;

      const savedTime = new Date(formData.timestamp);
      const hoursDiff = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60);
      if (hoursDiff >= 24 || !formData.form) return;

      setForm((prev) => ({ ...prev, ...formData.form }));
      setCurrentStep(formData.currentStep && formData.currentStep > 0 ? Math.min(totalSteps, formData.currentStep) : 1);
      setExpandedSections(new Set(formData.expandedSections?.length ? formData.expandedSections : ['genel']));
    } catch (error) {
      console.warn("Kaydedilen form yüklenemedi:", error);
    }
  }, [open, modalId, totalSteps, setForm]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        return;
      }

      if (event.key === 'Tab' && event.ctrlKey) {
        event.preventDefault();
        setCurrentStep((prev) => event.shiftKey ? Math.max(1, prev - 1) : Math.min(totalSteps, prev + 1));
        return;
      }

      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, totalSteps]);
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} wide id={modalId} style={{ height: '95vh', display: 'flex', flexDirection: 'column', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: RADIUS.lg,
            border: `1px solid ${mandatorySummary.remaining > 0 ? COLORS.warning : COLORS.success}`,
            background: mandatorySummary.remaining > 0 ? `${COLORS.warning}10` : `${COLORS.success}12`,
            display: "grid",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>Mecburi Bilgi Durumu</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>
                Cari kartı açılışı için önce zorunlu temel alanları tamamlayın.
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: mandatorySummary.remaining > 0 ? COLORS.warning : COLORS.success }}>
              {mandatorySummary.completed}/{mandatorySummary.items.length} tamam
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mandatorySummary.items.map((item) => (
              <span
                key={item.key}
                style={{
                  padding: "5px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  color: item.error ? COLORS.danger : item.filled ? COLORS.success : COLORS.warning,
                  background: item.error ? `${COLORS.danger}14` : item.filled ? `${COLORS.success}14` : `${COLORS.warning}14`,
                  border: `1px solid ${item.error ? COLORS.danger : item.filled ? COLORS.success : COLORS.warning}`,
                }}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
        {/* Progress Indicator */}
        <div style={{ marginBottom: 20, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>Form İlerlemesi</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: COLORS.muted }}>Ctrl+Tab: Adım değiştir</span>
              <span style={{ fontSize: 10, color: COLORS.muted }}>Esc: Kapat</span>
            </div>
          </div>
          <div style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                backgroundColor: COLORS.primary, 
                borderRadius: 3, 
                transition: 'width 0.3s ease',
                width: `${formProgress}%`
              }} 
            />
          </div>
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: COLORS.muted }}>Mecburi Alanlar (70%)</span>
            <span style={{ fontSize: 10, color: COLORS.muted }}>Opsiyonel Tamamlama (30%)</span>
          </div>
        </div>
        
        {/* Step Navigation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { id: 1, title: 'Mecburi Temel', section: 'genel', fields: ['company_name', 'account_type', 'phone', 'email'], requiredFields: ['company_name', 'account_type'] as AccountMandatoryFieldKey[] },
            { id: 2, title: 'Vergi ve Konum', section: 'vergi', fields: ['tax_id_type', 'tax_id', 'tax_office', 'city', 'country'] },
            { id: 3, title: 'Adres', section: 'adres', fields: ['address', 'city', 'district', 'country'] },
            { id: 4, title: 'Finansal', section: 'finansal', fields: ['credit_limit', 'payment_term_days', 'min_order_amount', 'discount_rate'] },
            { id: 5, title: 'Operasyonel', section: 'operasyonel', fields: ['dealer_type', 'delivery_days', 'warehouse_location'] },
            { id: 6, title: 'Sınıflandırma', section: 'siniflandirma', fields: ['grup_kod', 'sektor_kod', 'bolge_kod', 'temsilci_kod'] }
          ].map(step => {
          const isCompleted = step.requiredFields?.length
            ? step.requiredFields.every((field) => isAccountFieldFilled(form, field) && !validation[field])
            : expandedSections.has(step.section);
          
          const hasErrors = step.fields?.some(field => validation[field as keyof FormValidation]) ?? false;
          
          return (
            <Button
              key={step.id}
              type="button"
              variant={currentStep === step.id ? 'primary' : isCompleted ? 'ghost' : 'ghost'}
              size="sm"
              onClick={() => setCurrentStep(step.id)}
              style={{ 
                borderRadius: RADIUS.md,
                fontSize: 12,
                padding: '6px 12px',
                backgroundColor: currentStep === step.id ? primaryRgba(0.12) : 
                              isCompleted ? `${COLORS.success}15` : '#242424',
                border: `${hasErrors ? 2 : 1}px solid ${currentStep === step.id ? COLORS.primary : 
                        hasErrors ? COLORS.danger :
                        isCompleted ? COLORS.success : COLORS.border}`,
                color: currentStep === step.id ? COLORS.primary : 
                       isCompleted ? COLORS.success : COLORS.text,
                position: 'relative'
              }}
            >
              {step.title}
              {currentStep === step.id && <span style={{ marginLeft: 4, fontSize: 10, color: COLORS.primary }}></span>}
              {hasErrors && currentStep !== step.id && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, backgroundColor: COLORS.danger, borderRadius: '50%' }}></span>
              )}
            </Button>
          );
        })}
      </div>
      
      <form onSubmit={onSubmit} style={{ padding: "16px 0", display: "grid", gap: 20, overflowY: 'auto', flex: 1 }}>
        {/* Step 1: Genel Bilgiler */}
        {currentStep === 1 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Mecburi Temel Bilgiler" 
              expanded={expandedSections.has('genel')}
              onToggle={() => toggleSection('genel')}
              validationErrors={[
                validation.company_name ? 1 : 0,
                validation.account_type ? 1 : 0,
                validation.phone ? 1 : 0,
                validation.email ? 1 : 0
              ].reduce((a, b) => a + b, 0)}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <EnhancedInput 
                  id="acct-company-name" 
                  label="Firma Adı" 
                  value={form.company_name} 
                  onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))} 
                  placeholder="Firma adı" 
                  required 
                  error={validation.company_name}
                  hint="Müşterinin resmi firma adı"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select 
                    id="acct-type" 
                    label="Hesap Tipi*" 
                    value={form.account_type} 
                    onChange={(value) => setForm((prev) => ({ ...prev, account_type: String(value) }))} 
                    options={ACCOUNT_TYPE_OPTIONS}
                    error={validation.account_type}
                  />
                  {showMikroCariKod && (
                    <Input 
                      id="acct-mikro-cari-kod" 
                      label="Mikro Cari Kodu" 
                      value={form.mikro_cari_kod} 
                      onChange={(event) => setForm((prev) => ({ ...prev, mikro_cari_kod: event.target.value }))} 
                      placeholder="M-..." 
                    />
                  )}
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <EnhancedInput 
                    id="acct-phone" 
                    label="Telefon" 
                    value={form.phone} 
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} 
                    placeholder="05XX XXX XX XX" 
                    error={validation.phone}
                    hint="İletişim için kullanılacak telefon numarası"
                  />
                </div>
                <EnhancedInput 
                  id="acct-email" 
                  label="E-posta" 
                  type="email" 
                  value={form.email} 
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} 
                  placeholder="ornek@firma.com"
                  error={validation.email}
                  hint="Faturaların gönderileceği e-posta adresi"
                />
                <Input 
                  id="acct-website" 
                  label="Web Sitesi" 
                  type="url" 
                  value={form.website} 
                  onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} 
                  placeholder="https://firma.com" 
                />
                <Input 
                  id="acct-industry" 
                  label="Sektör" 
                  value={form.industry} 
                  onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))} 
                  placeholder="Mobilya / Mimari / Proje" 
                />
                <Input 
                  id="acct-tags" 
                  label="Etiketler" 
                  value={form.tags} 
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} 
                  placeholder="Bayi, İstanbul, VIP" 
                />
              </div>
            </FormSection>
          </div>
        )}
        
        {/* Step 2: Vergi Bilgileri */}
        {currentStep === 2 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Vergi ve Konum Bilgileri" 
              expanded={expandedSections.has('vergi')}
              onToggle={() => toggleSection('vergi')}
              validationErrors={[
                validation.tax_id_type ? 1 : 0,
                validation.tax_id ? 1 : 0,
                validation.tax_office ? 1 : 0,
                validation.city ? 1 : 0
              ].reduce((a, b) => a + b, 0)}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select
                    id="acct-tax-id-type"
                    label="Kimlik Tipi"
                    value={form.tax_id_type}
                    onChange={(value) => setForm((prev) => ({ ...prev, tax_id_type: String(value) }))}
                    options={TAX_ID_TYPE_OPTIONS}
                    error={validation.tax_id_type}
                  />
                <EnhancedInput
                    id="acct-tax-id"
                    label={taxIdLabel}
                    value={form.tax_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, tax_id: event.target.value }))}
                    placeholder={form.tax_id_type === "TCKN" ? "11 haneli TC" : "VKN"}
                    error={validation.tax_id}
                    hint={form.tax_id_type === "TCKN" ? "11 haneli TC Kimlik No" : "10 haneli Vergi No"}
                  />
                </div>
                <EnhancedInput 
                  id="acct-tax-office" 
                  label="Vergi Dairesi" 
                  value={form.tax_office} 
                  onChange={(event) => setForm((prev) => ({ ...prev, tax_office: event.target.value }))} 
                  placeholder="Maslak"
                  error={validation.tax_office}
                  hint="Vergi dairesi adı"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-city" 
                    label="İl" 
                    value={form.city} 
                    onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} 
                    placeholder="İstanbul"
                    error={validation.city}
                    hint="Şehir adı"
                  />
                  <EnhancedInput 
                    id="acct-district" 
                    label="İlçe" 
                    value={form.district} 
                    onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} 
                    placeholder="Ümraniye"
                    hint="İlçe adı"
                  />
                </div>
                <EnhancedInput
                  id="acct-country"
                  label="Ülke"
                  value={form.country}
                  onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                  placeholder="Türkiye"
                  hint="Ülke adı"
                />
                <Input id="acct-address" label="Adres" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Açık adres" />
              </div>
            </FormSection>
          </div>
        )}
        
        {/* Step 3: Adres Bilgileri */}
        {currentStep === 3 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Adres Detayları" 
              expanded={expandedSections.has('adres')}
              onToggle={() => toggleSection('adres')}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <EnhancedInput id="acct-address" label="Detaylı Adres" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Açık adres" hint="Sokak, bina no, daire" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput id="acct-city" label="İl" value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="İstanbul" error={validation.city} hint="Şehir adı" />
                  <EnhancedInput id="acct-district" label="İlçe" value={form.district} onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} placeholder="Ümraniye" hint="İlçe adı" />
                </div>
                <EnhancedInput id="acct-country" label="Ülke" value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} placeholder="Türkiye" hint="Ülke adı" />
              </div>
            </FormSection>
          </div>
        )}
        
        {/* Step 4: Finansal Bilgiler */}
        {currentStep === 4 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Finansal Bilgiler" 
              expanded={expandedSections.has('finansal')}
              onToggle={() => toggleSection('finansal')}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-credit-limit" 
                    label="Kredi Limiti" 
                    type="number" 
                    value={form.credit_limit} 
                    onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))} 
                    placeholder="Örn. 50000"
                    hint="TL cinsinden kredi limiti"
                  />
                  <EnhancedInput 
                    id="acct-payment-term" 
                    label="Vade (Gün)" 
                    type="number" 
                    value={form.payment_term_days} 
                    onChange={(event) => setForm((prev) => ({ ...prev, payment_term_days: event.target.value }))} 
                    placeholder="Örn. 30"
                    hint="Ödeme vadesi (gün)"
                    error={validation.payment_term_days}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-min-order" 
                    label="Minimum Sipariş" 
                    type="number" 
                    value={form.min_order_amount} 
                    onChange={(event) => setForm((prev) => ({ ...prev, min_order_amount: event.target.value }))} 
                    placeholder="Örn. 1500"
                    hint="Minimum sipariş tutarı (TL)"
                  />
                  <EnhancedInput 
                    id="acct-discount-rate" 
                    label="İskonto Oranı (%)" 
                    type="number" 
                    value={form.discount_rate} 
                    onChange={(event) => setForm((prev) => ({ ...prev, discount_rate: event.target.value }))} 
                    placeholder="Örn. 8"
                    hint="İskonto yüzdesi (0-100)"
                    error={validation.discount_rate}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-plaka-fiyat" 
                    label="Plaka Birim Fiyat (TL)" 
                    type="number" 
                    value={form.plaka_birim_fiyat} 
                    onChange={(event) => setForm((prev) => ({ ...prev, plaka_birim_fiyat: event.target.value }))} 
                    placeholder="Ör: 450"
                    hint="Plaka birim fiyatı (TL)"
                  />
                  <EnhancedInput 
                    id="acct-bant-fiyat" 
                    label="Bant Metre Fiyat (TL)" 
                    type="number" 
                    value={form.bant_metre_fiyat} 
                    onChange={(event) => setForm((prev) => ({ ...prev, bant_metre_fiyat: event.target.value }))} 
                    placeholder="Ör: 12"
                    hint="Bant metre fiyatı (TL)"
                  />
                </div>
              </div>
            </FormSection>
          </div>
        )}
        
        {/* Step 5: Operasyonel Bilgiler */}
        {currentStep === 5 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Operasyonel ve Üretim Bilgileri" 
              expanded={expandedSections.has('operasyonel')}
              onToggle={() => toggleSection('operasyonel')}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select 
                    id="acct-dealer-type" 
                    label="Bayi Tipi" 
                    value={form.dealer_type} 
                    onChange={(value) => setForm((prev) => ({ ...prev, dealer_type: String(value) }))} 
                    options={DEALER_TYPE_OPTIONS} 
                  />
                  <EnhancedInput 
                    id="acct-delivery-days" 
                    label="Teslim Günü" 
                    type="number" 
                    value={form.delivery_days} 
                    onChange={(event) => setForm((prev) => ({ ...prev, delivery_days: event.target.value }))} 
                    placeholder="Örn. 7"
                    hint="Ortalama teslim süresi (gün)"
                  />
                </div>
                <EnhancedInput 
                  id="acct-warehouse" 
                  label="Depo Lokasyonu" 
                  value={form.warehouse_location} 
                  onChange={(event) => setForm((prev) => ({ ...prev, warehouse_location: event.target.value }))} 
                  placeholder="Ana depo / Raf 4"
                  hint="Varsayılan depo konumu"
                />
                <EnhancedInput 
                  id="acct-pref-materials" 
                  label="Tercih Edilen Malzemeler" 
                  value={form.preferred_materials} 
                  onChange={(event) => setForm((prev) => ({ ...prev, preferred_materials: event.target.value }))} 
                  placeholder="MDF, Suntalam, Lake"
                  hint="Müşterinin tercih ettiği malzemeler"
                />
                <EnhancedInput 
                  id="acct-pref-colors" 
                  label="Tercih Edilen Renkler" 
                  value={form.preferred_colors} 
                  onChange={(event) => setForm((prev) => ({ ...prev, preferred_colors: event.target.value }))} 
                  placeholder="Beyaz, Antrasit, Meşe"
                  hint="Müşterinin tercih ettiği renkler"
                />
                <div style={{ 
                  display: "flex", 
                  gap: 16, 
                  alignItems: "center",
                  padding: '12px',
                  backgroundColor: '#1f1f1f',
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`
                }}>
                  <label 
                    htmlFor="acct-install-service" 
                    style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.text, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    <input 
                      id="acct-install-service" 
                      type="checkbox" 
                      checked={form.installation_service_available} 
                      onChange={(event) => setForm((prev) => ({ ...prev, installation_service_available: event.target.checked }))} 
                      style={{ 
                        width: 18,
                        height: 18,
                        accentColor: COLORS.primary,
                        cursor: 'pointer'
                      }} 
                    />
                    <span>Montaj hizmeti mevcut</span>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select
                    id="acct-durum"
                    label="Cari Durumu"
                    value={form.durum}
                    onChange={(value) => setForm((prev) => ({ ...prev, durum: String(value) }))}
                    options={DURUM_OPTIONS}
                  />
                  <Select
                    id="acct-vergi-tipi"
                    label="Vergi Tipi"
                    value={form.vergi_tipi}
                    onChange={(value) => setForm((prev) => ({ ...prev, vergi_tipi: String(value) }))}
                    options={VERGI_TIPI_OPTIONS}
                  />
                </div>
              </div>
            </FormSection>
          </div>
        )}
        
        {/* Step 6: Sınıflandırma */}
        {currentStep === 6 && (
          <div style={{ display: "grid", gap: 20 }}>
            <FormSection 
              title="Sınıflandırma Bilgileri" 
              expanded={expandedSections.has('siniflandirma')}
              onToggle={() => toggleSection('siniflandirma')}
              validationErrors={[
                validation.grup_kod ? 1 : 0,
                validation.sektor_kod ? 1 : 0,
                validation.risk_seviyesi ? 1 : 0,
                validation.odeme_tipi ? 1 : 0
              ].reduce((a, b) => a + b, 0)}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-grup-kod" 
                    label="Cari Grup" 
                    value={form.grup_kod} 
                    onChange={(event) => setForm((prev) => ({ ...prev, grup_kod: event.target.value }))} 
                    placeholder="Örn: BAYI, PROJE"
                    hint="Cari grup kodu"
                  />
                  <EnhancedInput 
                    id="acct-sektor-kod" 
                    label="Sektör Kodu" 
                    value={form.sektor_kod} 
                    onChange={(event) => setForm((prev) => ({ ...prev, sektor_kod: event.target.value }))} 
                    placeholder="Örn: MOB, MIM"
                    hint="Sektör kodu"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <EnhancedInput 
                    id="acct-bolge-kod" 
                    label="Bölge Kodu" 
                    value={form.bolge_kod} 
                    onChange={(event) => setForm((prev) => ({ ...prev, bolge_kod: event.target.value }))} 
                    placeholder="Örn: IST, ANK"
                    hint="Coğrafi bölge kodu"
                  />
                  <EnhancedInput 
                    id="acct-temsilci-kod" 
                    label="Satış Temsilcisi" 
                    value={form.temsilci_kod} 
                    onChange={(event) => setForm((prev) => ({ ...prev, temsilci_kod: event.target.value }))} 
                    placeholder="Temsilci kodu"
                    hint="Atanan satış temsilcisi"
                  />
                </div>
                {/* Additional classification fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select 
                    id="acct-risk-seviyesi" 
                    label="Risk Seviyesi" 
                    value={form.risk_seviyesi || ''} 
                    onChange={(value) => setForm((prev) => ({ ...prev, risk_seviyesi: String(value) }))} 
                    options={RISK_SEVIYESI_OPTIONS}
                  />
                  <Select 
                    id="acct-odeme-tipi" 
                    label="Ödeme Tipi" 
                    value={form.odeme_tipi || ''} 
                    onChange={(value) => setForm((prev) => ({ ...prev, odeme_tipi: String(value) }))} 
                    options={ODEME_TIPI_OPTIONS}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select 
                    id="acct-teslimat-sikligi" 
                    label="Teslimat Sıklığı" 
                    value={form.teslimat_sikligi || ''} 
                    onChange={(value) => setForm((prev) => ({ ...prev, teslimat_sikligi: String(value) }))} 
                    options={TESLIMAT_SIKLIGI_OPTIONS}
                  />
                  <EnhancedInput 
                    id="acct-ozel-kod" 
                    label="Özel Kod" 
                    value={form.ozel_kod || ''} 
                    onChange={(event) => setForm((prev) => ({ ...prev, ozel_kod: event.target.value }))} 
                    placeholder="Müşteri özel kodu"
                    hint="Özel tanımlama kodu"
                  />
                </div>
              </div>
            </FormSection>
          </div>
        )}
        <FormSection 
          title="Notlar ve Ek Bilgiler"
          expanded={expandedSections.has('notes')}
          onToggle={() => toggleSection('notes')}
        >
          <label style={{ display: "grid", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Operasyonel Notlar</span>
            <textarea 
              value={form.notes} 
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} 
              placeholder="Cari ile ilgili operasyonel notlar, özel durumlar, vade gereksinimleri vb." 
              rows={4} 
              style={{ 
                width: "100%", 
                borderRadius: RADIUS.md, 
                border: `1px solid ${COLORS.border}`, 
                padding: "10px 12px", 
                background: '#1a1a1a', 
                color: COLORS.text, 
                resize: "vertical",
                fontSize: 13,
                lineHeight: 1.5
              }} 
            />
          </label>
        </FormSection>
        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, backgroundColor: '#1a1a1a', padding: '16px 0', marginTop: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              style={{ 
                opacity: currentStep === 1 ? 0.5 : 1,
                cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Önceki
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
              disabled={currentStep === totalSteps}
              style={{ 
                opacity: currentStep === totalSteps ? 0.5 : 1,
                cursor: currentStep === totalSteps ? 'not-allowed' : 'pointer'
              }}
            >
              Sonraki
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Adım {currentStep}/{totalSteps}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: i + 1 <= currentStep ? COLORS.primary : COLORS.border,
                      transition: 'background-color 0.3s ease'
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  setPreviewForm(form);
                  setPreviewOpen(true);
                }}
                style={{ 
                  border: `1px solid ${COLORS.primary}`,
                  color: COLORS.primary
                }}
              >
                Önizle
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                style={{ 
                  border: `1px solid ${COLORS.danger}`,
                  color: COLORS.danger
                }}
              >
                Vazgeç
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={busy || Object.keys(validation).length > 0}
                style={{ 
                  minWidth: 140,
                  opacity: (busy || Object.keys(validation).length > 0) ? 0.7 : 1,
                  cursor: (busy || Object.keys(validation).length > 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {busy
                  ? busyLabel
                  : hasMandatoryErrors
                    ? `Mecburi Bilgileri Tamamla (${mandatorySummary.remaining})`
                    : Object.keys(validation).length > 0
                      ? `Hataları Düzelt (${Object.keys(validation).length})`
                      : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </form>
      </div>
    </Modal>
  );
}

// Kullanılmayan ama derleme uyumluluğu için bırakılan referans
const _AccountBlockingNote = AccountBlockingNote;
void _AccountBlockingNote;

export function AccountsWorkspace({ openCreateOnMount = false, onCreateOpenHandled }: AccountsWorkspaceProps = {}) {
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CRMAccount | null>(null);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactCreating, setContactCreating] = useState(false);
  const [contactCreateError, setContactCreateError] = useState<string | null>(null);

  // Form önizleme state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState<AccountFormState>({ ...EMPTY_ACCOUNT_FORM });

  const [addresses, setAddresses] = useState<CRMAddress[]>([]);
  const [addressCreateOpen, setAddressCreateOpen] = useState(false);
  const [addressEditOpen, setAddressEditOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CRMAddress | null>(null);
  const [addressForm, setAddressForm] = useState({ address_title: "", address_line: "", city: "", district: "", country: "Türkiye", address_type: "MERKEZ" as AddressType, is_primary: false });

  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactUpdating, setContactUpdating] = useState(false);
  const [contactEditError, setContactEditError] = useState<string | null>(null);

  // Mikro'ya Yaz state
  const [isWritingMikro, setIsWritingMikro] = useState(false);
  const [mikroWriteResult, setMikroWriteResult] = useState<{ success: boolean; message: string } | null>(null);
  const mikroWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 1280 : false));
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setIsCompactLayout(window.innerWidth < 1280);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  useEffect(() => {
    if (editingAddress) {
      setAddressForm({
        address_title: editingAddress.addressTitle || "",
        address_line: editingAddress.addressLine || "",
        city: editingAddress.city || "",
        district: editingAddress.district || "",
        country: editingAddress.country || "Türkiye",
        address_type: editingAddress.addressType || "MERKEZ",
        is_primary: editingAddress.isPrimary || false
      });
    } else {
      setAddressForm({ address_title: "", address_line: "", city: "", district: "", country: "Türkiye", address_type: "MERKEZ", is_primary: false });
    }
  }, [editingAddress]);

  // Mikro banner temizleme
  useEffect(() => {
    return () => {
      if (mikroWriteTimerRef.current) clearTimeout(mikroWriteTimerRef.current);
    };
  }, []);

  const [filters, setFilters] = useState<AccountFilterState>({
    search: "",
    accountType: "ALL",
    city: "",
    mikroState: "ALL",
    showInactive: false,
  });
  const [detailTab, setDetailTab] = useState<AccountDetailTab>("general");
  const [createForm, setCreateForm] = useState<AccountFormState>({ ...EMPTY_ACCOUNT_FORM });
  const [editForm, setEditForm] = useState<AccountFormState>({ ...EMPTY_ACCOUNT_FORM });
  const [contactForm, setContactForm] = useState({ ...EMPTY_CONTACT_FORM });

  const accountCount = accounts.length;
  const mappedCount = accounts.filter((account) => Boolean(account.mikroCariKod)).length;
  const totalBalance = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
  const averageTerm = accountCount ? Math.round(accounts.reduce((sum, account) => sum + (account.paymentTermDays ?? 0), 0) / accountCount) : 0;

  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.accountType, filters.city, filters.mikroState, filters.showInactive]);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setCreateError(null);
    setCreateForm({ ...EMPTY_ACCOUNT_FORM });
    setCreateOpen(true);
    onCreateOpenHandled?.();
  }, [openCreateOnMount, onCreateOpenHandled]);


  async function loadAddressesForAccount(accountId: string) {
    try {
      const data = await crmService.listAddresses(accountId);
      setAddresses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Adresler yuklenemedi:", error);
      setAddresses([]);
    }
  }

  async function handleDeleteAddress(addressId: string) {
    if (!window.confirm("Bu adresi silmek istediğinize emin misiniz?")) return;
    try {
      await crmService.deleteAddress(addressId);
      setAddresses(prev => prev.filter(a => a.id !== addressId));
      notificationHelpers.success("Adres silindi.");
     } catch {
       notificationHelpers.error("Adres silinemedi.");
    }
  }

  async function loadContactsForAccount(accountId: string) {
    try {
      const contactsData = await crmService.listContacts({ account_id: accountId });
      setContacts(contactsData);
    } catch (error) {
      console.error("Kisiler yuklenemedi:", error);
      setContacts([]);
    }
  }

  async function loadAccounts(preferredAccountId?: string) {
    try {
      setLoading(true);
      const data = await crmService.listAccounts({
        search: filters.search.trim() || undefined,
        is_active: filters.showInactive ? undefined : true,
        account_type: filters.accountType !== "ALL" ? filters.accountType : undefined,
        city: filters.city.trim() || undefined,
        has_mikro_cari_kod: filters.mikroState === "ONLY_MAPPED" ? true : filters.mikroState === "ONLY_UNMAPPED" ? false : undefined,
      });
      setAccounts(data);
      const nextSelected = (preferredAccountId ? data.find((item) => item.id === preferredAccountId) : null) ?? (selectedAccount ? data.find((item) => item.id === selectedAccount.id) : null) ?? data[0] ?? null;
      setSelectedAccount(nextSelected);
      if (nextSelected) {
        await loadContactsForAccount(nextSelected.id);
        await loadAddressesForAccount(nextSelected.id);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error("Cari hesaplar yuklenemedi:", error);
      setAccounts([]);
      setSelectedAccount(null);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function selectAccount(account: CRMAccount) {
    setSelectedAccount(account);
    setDetailTab("general");
    setMikroWriteResult(null);
    await loadContactsForAccount(account.id);
    await loadAddressesForAccount(account.id);
  }

  function openCreateModal() {
    setCreateError(null);
    setCreateForm({ ...EMPTY_ACCOUNT_FORM });
    setCreateOpen(true);
  }

  function openEditModal() {
    if (!selectedAccount) return;
    setEditError(null);
    setEditForm(createAccountFormState(selectedAccount));
    setEditOpen(true);
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { payload, error } = parseAccountPayload(createForm, "create");
    if (error) {
      setCreateError(error);
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const created = await crmService.createAccount(payload as AccountInput);
      setAccounts((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedAccount(created);
      setContacts([]);
      setCreateForm({ ...EMPTY_ACCOUNT_FORM });
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Cari hesap oluşturulamadi.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    const { payload, error } = parseAccountPayload(editForm, "edit");
    if (error) {
      setEditError(error);
      return;
    }

    setUpdating(true);
    setEditError(null);

    try {
      const updated = await crmService.updateAccount(selectedAccount.id, payload as Partial<AccountInput>);
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAccount(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Cari hesap güncellenemedi.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeactivateAccount() {
    if (!selectedAccount) return;
    setDeactivating(true);
    setDeleteError(null);

    try {
      await crmService.deleteAccount(selectedAccount.id);
      const nextAccounts = accounts.filter((item) => item.id !== selectedAccount.id);
      setAccounts(nextAccounts);
      const nextSelected = nextAccounts[0] ?? null;
      setSelectedAccount(nextSelected);
      if (nextSelected) {
        await loadContactsForAccount(nextSelected.id);
        await loadAddressesForAccount(nextSelected.id);
      } else {
        setContacts([]);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Cari hesap pasiflestirilemedi.");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleWriteToMikro() {
    if (!selectedAccount) return;
    setIsWritingMikro(true);
    setMikroWriteResult(null);
    try {
      const res = await apiRequest<{ message?: string }>(`/api/v1/mikro/write-cari`, { method: "POST", body: JSON.stringify({ cari_id: selectedAccount.id }), headers: { "Content-Type": "application/json" } });
      setMikroWriteResult({ success: true, message: (res as { message?: string }).message ?? "Yazım başarılı" });
    } catch {
      setMikroWriteResult({ success: false, message: "Mikro yazım hatası" });
    } finally {
      setIsWritingMikro(false);
      if (mikroWriteTimerRef.current) clearTimeout(mikroWriteTimerRef.current);
      mikroWriteTimerRef.current = setTimeout(() => setMikroWriteResult(null), 3000);
    }
  }

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) {
      setContactCreateError("Yetkili eklemek icin once bir cari secin.");
      return;
    }

    const { payload, error } = parseContactPayload(selectedAccount.id, contactForm);
    if (error || !payload) {
      setContactCreateError(error ?? "Yetkili olusturulamadi.");
      return;
    }

    setContactCreating(true);
    setContactCreateError(null);

    try {
      const created = await crmService.createContact(payload);
      setContacts((prev) => [created, ...prev]);
      setContactForm({ ...EMPTY_CONTACT_FORM });
      setContactCreateOpen(false);
    } catch (err) {
      setContactCreateError(err instanceof Error ? err.message : "Yetkili oluşturulamadi.");
    } finally {
      setContactCreating(false);
    }
  }

  async function handleUpdateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContact) return;

    const { payload, error } = parseContactPayload(editingContact.accountId, contactForm);
    if (error || !payload) {
      setContactEditError(error ?? "Yetkili güncellenemedi.");
      return;
    }

    setContactUpdating(true);
    setContactEditError(null);

    try {
      const updated = await crmService.updateContact(editingContact.id, payload as Partial<ContactInput>);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setContactEditOpen(false);
      notificationHelpers.success("Yetkili güncellendi.");
    } catch (err) {
      setContactEditError(err instanceof Error ? err.message : "Yetkili güncellenemedi.");
    } finally {
      setContactUpdating(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!window.confirm("Bu yetkiliyi silmek istediğinize emin misiniz?")) return;
    try {
      await crmService.deleteContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      notificationHelpers.success("Yetkili silindi.");
    } catch {
      notificationHelpers.error("Yetkili silinemedi.");
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
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <AccountMetricCard label="Aktif Cari" value={String(accountCount)} hint="Filtre sonucu görünen kayıt" />
          <AccountMetricCard label="Mikro Eşleşen" value={String(mappedCount)} hint="Cari kodu atanmış hesap" />
          <AccountMetricCard label="Toplam Bakiye" value={formatCurrencyValue(totalBalance)} hint="Görünen liste toplamı" />
          <AccountMetricCard label="Ortalama Vade" value={`${averageTerm} gün`} hint="Ödeme günü ortalaması" />
        </div>
        <Card title="Cari Filtreleri" subtitle="Arama, tür, bölge ve Mikro eşleşme görünümü" actions={<Button type="button" variant="ghost" size="sm" onClick={() => setFilters({ search: "", accountType: "ALL", city: "", mikroState: "ALL", showInactive: false })}>Filtreleri Temizle</Button>} style={workspaceCardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(220px, 2fr) repeat(3, minmax(160px, 1fr)) auto", gap: 14, alignItems: "end" }}>
            <Input id="filter-search" label="Cari Ara" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Ünvan, VKN, telefon, e-posta" />
            <Select id="filter-acct-type" label="Hesap Tipi Filtre" value={filters.accountType} onChange={(value) => setFilters((prev) => ({ ...prev, accountType: String(value) }))} options={ACCOUNT_TYPE_FILTER_OPTIONS} />
            <Input id="filter-city" label="Şehir" value={filters.city} onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))} placeholder="İstanbul" />
            <Select id="filter-mikro-state" label="Mikro Durumu" value={filters.mikroState} onChange={(value) => setFilters((prev) => ({ ...prev, mikroState: value as MikroFilterState }))} options={MIKRO_FILTER_OPTIONS} />
            <label htmlFor="filter-show-inactive" style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 13, fontWeight: 500, minHeight: 44 }}>
              <input id="filter-show-inactive" type="checkbox" checked={filters.showInactive} onChange={(event) => setFilters((prev) => ({ ...prev, showInactive: event.target.checked }))} style={{ accentColor: COLORS.primary }} />
              Pasifleri göster
            </label>
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(320px, 380px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <Card title="Cari Listesi" subtitle={`${accounts.length} kayıt görünür • Mikro uyumlu yoğun liste`} actions={<div style={{ display: "flex", gap: 8 }}><Button type="button" variant="ghost" size="sm" onClick={() => void loadAccounts(selectedAccount?.id)}>Yenile</Button><Button type="button" variant="primary" size="sm" onClick={openCreateModal}>+ Yeni Cari</Button></div>} style={workspaceCardStyle}>
            <div style={{ maxHeight: isCompactLayout ? "none" : "680px", overflowY: "auto", display: "grid", gap: 8, paddingRight: 4 }}>
              {accounts.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: COLORS.muted }}>Filtreye uyan cari hesap bulunamadı.</div>
              ) : (
                accounts.map((account) => {
                  const accountTags = splitTagValues(account.tags);
                  const isSelected = selectedAccount?.id === account.id;
                  return (
                    <div
                      key={account.id}
                      role="button"
                      aria-label={`${account.companyName} detayını aç`}
                      onClick={() => void selectAccount(account)}
                      style={getAccountListItemStyle(isSelected)}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" }}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{account.companyName}</span>
                          <span style={{ fontSize: 11, color: COLORS.muted }}>
                            {describeAccountType(account.accountType)}
                            {account.city || account.district ? ` • ${[account.city, account.district].filter(Boolean).join(" / ")}` : ""}
                          </span>
                          <span style={{ fontSize: 11, color: COLORS.muted }}>
                            {account.phone || account.email || account.taxId || "İletişim / vergi bilgisi bekleniyor"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {account.mikroCariKod ? <Badge variant="success">Mikro</Badge> : <Badge variant="secondary">Bekliyor</Badge>}
                          {account.isActive ? <Badge variant="info">Aktif</Badge> : <Badge variant="warning">Pasif</Badge>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {account.paymentTermDays != null ? <Badge variant="secondary">Vade {account.paymentTermDays} gün</Badge> : null}
                        {account.creditLimit != null ? <Badge variant="warning">Kredi {formatCurrencyValue(account.creditLimit)}</Badge> : null}
                        {account.discountRate != null ? <Badge variant="success">İskonto %{formatNumberValue(account.discountRate)}</Badge> : null}
                        {account.deliveryDays != null ? <Badge variant="secondary">Teslim {account.deliveryDays} gün</Badge> : null}
                      </div>
                      {accountTags.length ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {accountTags.slice(0, 3).map((tag) => (
                            <Badge key={`${account.id}-${tag}`} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <Card title="Cari Çalışma Alanı" subtitle={selectedAccount ? "Mikro uyumlu yatay detay görünümü" : "Soldaki listeden bir cari seçildiğinde çalışma alanı burada açılır"} style={workspaceCardStyle}>
              <div style={{ display: "grid", gap: 18 }}>
                {selectedAccount ? (
                  <>
                {deleteError ? (
                  <div style={{ 
                    padding: '10px 12px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    border: `1px solid ${COLORS.danger}`, 
                    borderRadius: RADIUS.md,
                    color: COLORS.danger,
                    fontSize: 13,
                    marginBottom: 12
                  }}>
                    <span style={{ fontWeight: 600 }}>Hata: </span>{deleteError}
                  </div>
                ) : null}
                {mikroWriteResult ? (
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: RADIUS.md,
                    fontSize: 12,
                    fontWeight: 600,
                    background: mikroWriteResult.success ? `${COLORS.success}18` : `${COLORS.danger}18`,
                    color: mikroWriteResult.success ? COLORS.success : COLORS.danger,
                    border: `1px solid ${mikroWriteResult.success ? COLORS.success : COLORS.danger}`,
                  }}>
                    {mikroWriteResult.message}
                  </div>
                ) : null}

                <div style={{ padding: "10px 12px", borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: '#242424', display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>{selectedAccount.companyName}</span>
                        {selectedAccount.isActive ? <Badge variant="info">Aktif</Badge> : <Badge variant="warning">Pasif</Badge>}
                        {selectedAccount.mikroCariKod ? <Badge variant="success">Mikro Eşleşti</Badge> : <Badge variant="secondary">Mikro Bekliyor</Badge>}
                      </div>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>
                        {describeAccountType(selectedAccount.accountType)}
                        {selectedAccount.city || selectedAccount.district ? ` • ${[selectedAccount.city, selectedAccount.district].filter(Boolean).join(" / ")}` : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Button type="button" variant="secondary" size="sm" onClick={openEditModal}>Düzenle</Button>
                      <button
                        type="button"
                        onClick={() => void handleWriteToMikro()}
                        disabled={isWritingMikro}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          height: 32,
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#242424',
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.md,
                          color: COLORS.text,
                          cursor: isWritingMikro ? "not-allowed" : "pointer",
                          opacity: isWritingMikro ? 0.6 : 1,
                        }}
                      >
                        <Upload size={13} />
                        {isWritingMikro ? "Yazılıyor..." : "Mikro'ya Yaz"}
                      </button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>Tarihçe</Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => void handleDeactivateAccount()} disabled={deactivating}>{deactivating ? "İşleniyor..." : "Pasife Al"}</Button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                    <AccountDetailField label="Mikro Cari Kodu" value={selectedAccount.mikroCariKod ?? "Bekliyor"} />
                    <AccountDetailField label="Telefon" value={selectedAccount.phone ?? "Yok"} />
                    <AccountDetailField label="E-posta" value={selectedAccount.email ?? "Yok"} />
                    <AccountDetailField label="Bakiye" value={formatCurrencyValue(selectedAccount.balance)} />
                    <AccountDetailField label="Kredi Limiti" value={formatCurrencyValue(selectedAccount.creditLimit)} />
                    <AccountDetailField label="Vade" value={selectedAccount.paymentTermDays != null ? `${selectedAccount.paymentTermDays} gün` : "Yok"} />
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 0 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                    {[
                      { id: "general", label: "Genel" },
                      { id: "commercial", label: "Ticari" },
                      { id: "operations", label: "Operasyon" },
                      { id: "addresses", label: `Adresler (${addresses.length})` },
                      { id: "contacts", label: `Yetkililer (${contacts.length})` },
                      { id: "technical", label: "Teknik" },
                    ].map((tab) => {
                      const active = detailTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDetailTab(tab.id as AccountDetailTab)}
                          style={getDenseTabButtonStyle(active)}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === "general" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <AccountSection title="Kimlik ve Profil">
                        <AccountDetailField label="Hesap Tipi" value={describeAccountType(selectedAccount.accountType)} />
                        <AccountDetailField label="Sektör" value={selectedAccount.industry ?? "Yok"} />
                        <AccountDetailField label="Web" value={selectedAccount.website ?? "Yok"} />
                        <AccountDetailField label="Etiketler" value={splitTagValues(selectedAccount.tags).join(", ") || "Yok"} />
                      </AccountSection>
                      <AccountSection title="Vergi ve Resmi Bilgiler">
                        <AccountDetailField label={(selectedAccount as unknown as Record<string, unknown>).taxIdType === "TCKN" ? "T.C. Kimlik No" : "Vergi No"} value={selectedAccount.taxId ?? "Yok"} />
                        <AccountDetailField label="Vergi Dairesi" value={selectedAccount.taxOffice ?? "Yok"} />
                        <AccountDetailField label="Ülke" value={(selectedAccount as unknown as Record<string, unknown>).country as string ?? "Türkiye"} />
                      </AccountSection>
                      <AccountSection title="İletişim">
                        <AccountDetailField label="Telefon" value={selectedAccount.phone ?? "Yok"} />
                        <AccountDetailField label="E-posta" value={selectedAccount.email ?? "Yok"} />
                        <AccountDetailField label="Adres" value={selectedAccount.address ?? "Yok"} />
                      </AccountSection>
                      <AccountSection title="Sınıflandırma">
                        <AccountDetailField label="Cari Grup" value={(selectedAccount as unknown as Record<string, unknown>).grupKod as string ?? "Yok"} />
                        <AccountDetailField label="Sektör Kodu" value={(selectedAccount as unknown as Record<string, unknown>).sektorKod as string ?? "Yok"} />
                        <AccountDetailField label="Bölge Kodu" value={(selectedAccount as unknown as Record<string, unknown>).bolgeKod as string ?? "Yok"} />
                        <AccountDetailField label="Satış Temsilcisi" value={(selectedAccount as unknown as Record<string, unknown>).temsilciKod as string ?? "Yok"} />
                      </AccountSection>
                    </div>
                  ) : null}

                  {detailTab === "commercial" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                      <AccountSection title="Ticari Koşullar">
                        <AccountDetailField label="Vade" value={selectedAccount.paymentTermDays != null ? `${selectedAccount.paymentTermDays} gün` : "Yok"} />
                        <AccountDetailField label="Minimum Sipariş" value={formatCurrencyValue(selectedAccount.minOrderAmount)} />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {selectedAccount.discountRate != null ? <Badge variant="success">İskonto %{formatNumberValue(selectedAccount.discountRate)}</Badge> : null}
                          {selectedAccount.plakaBirimFiyat != null ? <Badge variant="success">Plaka: {selectedAccount.plakaBirimFiyat} TL/adet</Badge> : null}
                          {selectedAccount.bantMetreFiyat != null ? <Badge variant="success">Bant: {selectedAccount.bantMetreFiyat} TL/m</Badge> : null}
                        </div>
                      </AccountSection>
                      <AccountSection title="Risk ve Limit">
                        <AccountDetailField label="Kredi Limiti" value={formatCurrencyValue(selectedAccount.creditLimit)} />
                        <AccountDetailField label="Bakiye" value={formatCurrencyValue(selectedAccount.balance)} />
                        <AccountDetailField label="Cari Durumu" value={selectedAccount.isActive ? "Aktif" : "Pasif"} />
                      </AccountSection>
                    </div>
                  ) : null}

                  {detailTab === "operations" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                      <AccountSection title="Operasyon ve Üretim">
                        <AccountDetailField label="Bayi Tipi" value={describeDealerType(selectedAccount.dealerType)} />
                        <AccountDetailField label="Montaj Hizmeti" value={selectedAccount.installationServiceAvailable ? "Var" : "Yok"} />
                        <AccountDetailField label="Teslim Süresi" value={selectedAccount.deliveryDays != null ? `${selectedAccount.deliveryDays} gün` : "Yok"} />
                        <AccountDetailField label="Depo Lokasyonu" value={selectedAccount.warehouseLocation ?? "Yok"} />
                      </AccountSection>
                      <AccountSection title="Tercihler">
                        <AccountDetailField label="Malzeme Tercihleri" value={selectedAccount.preferredMaterials ?? "Yok"} />
                        <AccountDetailField label="Renk Tercihleri" value={selectedAccount.preferredColors ?? "Yok"} />
                      </AccountSection>
                    </div>
                  ) : null}

                  {detailTab === "addresses" ? (
                    <AccountSection title={`Adresler (${addresses.length})`} action={<Button variant="ghost" size="sm" onClick={() => setAddressCreateOpen(true)}>+ Ekle</Button>}>
                      {(addresses ?? []).length === 0 ? (
                        <div style={{ padding: "10px 12px", textAlign: "center", color: COLORS.muted, fontSize: 12, border: `1px dashed ${COLORS.border}`, borderRadius: RADIUS.md }}>
                          Henüz adres tanımlanmamış.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {addresses.map((addr) => (
                            <div key={addr.id} style={{ padding: "8px 10px", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" }}>
                              <div style={{ display: "grid", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{addr.addressTitle}</span>
                                  {addr.isPrimary && <Badge variant="info">Birincil</Badge>}
                                  {addr.addressType && <Badge variant="secondary">{describeAddressType(addr.addressType)}</Badge>}
                                </div>
                                <span style={{ fontSize: 11, color: COLORS.muted }}>{addr.addressLine}</span>
                                <span style={{ fontSize: 11, color: COLORS.muted }}>{[addr.district, addr.city, addr.country].filter(Boolean).join(" / ") || "Konum bilgisi yok"}</span>
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                <Button variant="ghost" size="sm" onClick={() => { setEditingAddress(addr); setAddressEditOpen(true); }}>Düzenle</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteAddress(addr.id)} style={{ color: COLORS.danger }}>Sil</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccountSection>
                  ) : null}

                  {detailTab === "contacts" ? (
                    <AccountSection title={`Yetkililer (${contacts.length})`} action={<Button type="button" variant="secondary" size="sm" onClick={() => { setContactForm({ ...EMPTY_CONTACT_FORM }); setContactCreateError(null); setContactCreateOpen(true); }}>+ Yeni Yetkili</Button>}>
                      {contacts.length === 0 ? (
                        <div style={{ fontSize: 11, color: COLORS.muted }}>Henüz kişi eklenmemiş</div>
                      ) : (
                        contacts.map((contact) => (
                          <div key={contact.id} style={{ padding: "10px 12px", background: '#242424', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, display: "grid", gap: 3 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" }}>
                              <div style={{ display: "grid", gap: 3 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 13 }}>{contact.firstName} {contact.lastName}</span>
                                  {contact.isPrimary ? <Badge variant="info">Birincil</Badge> : null}
                                  {contact.title ? <Badge variant="secondary">{contact.title}</Badge> : null}
                                </div>
                                {contact.department ? <div style={{ fontSize: 11, color: COLORS.muted }}>{contact.department}</div> : null}
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setEditingContact(contact);
                                  setContactForm({
                                    first_name: contact.firstName,
                                    last_name: contact.lastName,
                                    title: contact.title || "",
                                    department: contact.department || "",
                                    phone: contact.phone || "",
                                    mobile: contact.mobile || "",
                                    email: contact.email || "",
                                    is_primary: contact.isPrimary,
                                    notes: contact.notes || "",
                                  });
                                  setContactEditError(null);
                                  setContactEditOpen(true);
                                }}>Düzenle</Button>
                                <Button variant="ghost" size="sm" style={{ color: COLORS.danger }} onClick={() => handleDeleteContact(contact.id)}>Sil</Button>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: COLORS.muted }}>
                              {contact.email ? <span>{contact.email}</span> : null}
                              {contact.phone ? <span>{contact.phone}</span> : null}
                              {contact.mobile ? <span>{contact.mobile}</span> : null}
                            </div>
                            {contact.notes ? <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{contact.notes}</div> : null}
                          </div>
                        ))
                      )}
                    </AccountSection>
                  ) : null}

                  {detailTab === "technical" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.72fr) minmax(360px, 1.28fr)", gap: 12, alignItems: "start" }}>
                      <AccountSection title="Audit Özeti" action={<Button type="button" variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>Tarihçe</Button>}>
                        <AccountDetailField label="Oluşturma Tarihi" value={new Date(selectedAccount.createdAt).toLocaleString("tr-TR")} />
                        <AccountDetailField label="Son Güncelleme" value={new Date(selectedAccount.updatedAt).toLocaleString("tr-TR")} />
                        <AccountDetailField label="Oluşturan" value={selectedAccount.createdBy ?? "Yok"} />
                        <AccountDetailField label="Mikro Durumu" value={selectedAccount.mikroCariKod ? "Eşleşti" : "Bekliyor"} />
                      </AccountSection>
                      <IntegrationReadonlyPanel entityType="ACCOUNT" entityId={selectedAccount.id} title="Cari Teknik Paneli" fallbackExternalId={selectedAccount.mikroCariKod ?? null} />
                    </div>
                  ) : null}
                </div>
                  </>
                ) : (
                  <div style={{ minHeight: isCompactLayout ? "320px" : "520px", display: "grid", placeItems: "center", textAlign: "center", color: COLORS.muted }}>
                    <div style={{ display: "grid", gap: 8, justifyItems: "center", maxWidth: 320 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 999, border: `1px solid ${COLORS.border}`, display: "grid", placeItems: "center", color: COLORS.primary, background: primaryRgba(0.08), fontSize: 22, fontWeight: 700 }}>C</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Cari çalışma alanı</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>Soldaki listeden bir cari seçildiğinde genel, ticari, operasyon, adres ve yetkili detayları burada açılır.</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
        </div>
      </div>      {selectedAccount && (
        <Modal open={auditOpen} onClose={() => setAuditOpen(false)} title="Cari Tarihçesi" subtitle={selectedAccount.companyName} id="account-audit-modal">
          <div style={{ display: "grid", gap: 12, padding: "8px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 3 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Oluşturma Tarihi</span>
                <span style={{ fontSize: 13, color: COLORS.text }}>{new Date(selectedAccount.createdAt).toLocaleString("tr-TR")}</span>
              </div>
              <div style={{ display: "grid", gap: 3 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Son Güncelleme</span>
                <span style={{ fontSize: 13, color: COLORS.text }}>{new Date(selectedAccount.updatedAt).toLocaleString("tr-TR")}</span>
              </div>
            </div>
            {selectedAccount.createdBy && (
              <div style={{ display: "grid", gap: 3 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Oluşturan</span>
                <span style={{ fontSize: 13, color: COLORS.text }}>{selectedAccount.createdBy}</span>
              </div>
            )}
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Cari Durumu</span>
              <span style={{ fontSize: 13, color: selectedAccount.isActive ? COLORS.success : COLORS.warning }}>
                {selectedAccount.isActive ? "Aktif" : "Pasif"}
              </span>
            </div>
          </div>
        </Modal>
      )}
      <AccountFormModal open={createOpen} title="Yeni Cari Oluştur" subtitle="Temel, ticari ve operasyonel alanları tek formda yönetin" submitLabel="Cari Kartı Oluştur" busyLabel="Kaydediliyor..." form={createForm} setForm={setCreateForm} error={createError} busy={creating} onClose={() => setCreateOpen(false)} onSubmit={handleCreateAccount} modalId="create-account-modal" />
      <AccountFormModal open={editOpen} title="Cari Düzenle" subtitle={selectedAccount ? `${selectedAccount.companyName} kartını güncelleyin` : "Cari kartını güncelleyin"} submitLabel="Cari Kartını Güncelle" busyLabel="Kaydediliyor..." form={editForm} setForm={setEditForm} error={editError} busy={updating} onClose={() => setEditOpen(false)} onSubmit={handleUpdateAccount} modalId="edit-account-modal" showMikroCariKod />
      <FormPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} formData={previewForm} />
      <Modal open={contactCreateOpen} onClose={() => setContactCreateOpen(false)} title="Yeni Yetkili Oluştur" subtitle={selectedAccount ? `${selectedAccount.companyName} için yetkili bilgileri` : "Yetkili bilgilerini girin"} id="create-contact-modal">
        <form onSubmit={handleCreateContact} style={{ display: "grid", gap: 14, padding: "8px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="cc-first-name" label="Ad" value={contactForm.first_name} onChange={(event) => setContactForm((prev) => ({ ...prev, first_name: event.target.value }))} placeholder="Yetkili adı" required />
            <Input id="cc-last-name" label="Soyad" value={contactForm.last_name} onChange={(event) => setContactForm((prev) => ({ ...prev, last_name: event.target.value }))} placeholder="Yetkili soyadı" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="cc-title" label="Unvan" value={contactForm.title} onChange={(event) => setContactForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Örn. Satış Sorumlusu" />
            <Input id="cc-department" label="Departman" value={contactForm.department} onChange={(event) => setContactForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Örn. Satın Alma" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <Input id="cc-phone" label="Telefon" value={contactForm.phone} onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Telefon" ariaDescribedBy="cc-phone-hint" />
              <span id="cc-phone-hint" style={{ fontSize: 11, color: COLORS.muted }}>Format: 05XX XXX XX XX</span>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Input id="cc-mobile" label="Mobil" value={contactForm.mobile} onChange={(event) => setContactForm((prev) => ({ ...prev, mobile: event.target.value }))} placeholder="Mobil" ariaDescribedBy="cc-mobile-hint" />
              <span id="cc-mobile-hint" style={{ fontSize: 11, color: COLORS.muted }}>Format: 05XX XXX XX XX</span>
            </div>
            <Input id="cc-email" type="email" label="E-posta" value={contactForm.email} onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="yetkili@firma.com" />
          </div>
          <label htmlFor="cc-is-primary" style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 13, fontWeight: 500 }}>
            <input id="cc-is-primary" type="checkbox" checked={contactForm.is_primary} onChange={(event) => setContactForm((prev) => ({ ...prev, is_primary: event.target.checked }))} style={{ accentColor: COLORS.primary }} />
            Birincil yetkili olarak işaretle
          </label>
          <label htmlFor="cc-notes" style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Notlar</span>
            <textarea id="cc-notes" value={contactForm.notes} onChange={(event) => setContactForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Yetkili ile ilgili kısa not" rows={3} style={{ width: "100%", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, padding: "8px 10px", background: '#1a1a1a', color: COLORS.text, resize: "vertical" }} />
          </label>
          {contactCreateError ? (
            <div style={{ 
              padding: '10px 12px', 
              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
              border: `1px solid ${COLORS.danger}`, 
              borderRadius: RADIUS.md,
              color: COLORS.danger,
              fontSize: 13
            }}>
              <span style={{ fontWeight: 600 }}>Hata: </span>{contactCreateError}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
            <Button type="button" variant="ghost" onClick={() => setContactCreateOpen(false)}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={contactCreating || !selectedAccount}>{contactCreating ? "Kaydediliyor..." : "Yetkili Oluştur"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={contactEditOpen} onClose={() => setContactEditOpen(false)} title="Yetkili Düzenle" subtitle={editingContact ? `${editingContact.firstName} ${editingContact.lastName} bilgilerini güncelleyin` : "Yetkili bilgileri"} id="edit-contact-modal">
        <form onSubmit={handleUpdateContact} style={{ display: "grid", gap: 14, padding: "8px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="ce-first-name" label="Ad" value={contactForm.first_name} onChange={(event) => setContactForm((prev) => ({ ...prev, first_name: event.target.value }))} placeholder="Yetkili adı" required />
            <Input id="ce-last-name" label="Soyad" value={contactForm.last_name} onChange={(event) => setContactForm((prev) => ({ ...prev, last_name: event.target.value }))} placeholder="Yetkili soyadı" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="ce-title" label="Unvan" value={contactForm.title} onChange={(event) => setContactForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Örn. Satış Sorumlusu" />
            <Input id="ce-department" label="Departman" value={contactForm.department} onChange={(event) => setContactForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Örn. Satın Alma" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <Input id="ce-phone" label="Telefon" value={contactForm.phone} onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Telefon" ariaDescribedBy="ce-phone-hint" />
              <span id="ce-phone-hint" style={{ fontSize: 11, color: COLORS.muted }}>Format: 05XX XXX XX XX</span>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Input id="ce-mobile" label="Mobil" value={contactForm.mobile} onChange={(event) => setContactForm((prev) => ({ ...prev, mobile: event.target.value }))} placeholder="Mobil" ariaDescribedBy="ce-mobile-hint" />
              <span id="ce-mobile-hint" style={{ fontSize: 11, color: COLORS.muted }}>Format: 05XX XXX XX XX</span>
            </div>
            <Input id="ce-email" type="email" label="E-posta" value={contactForm.email} onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="yetkili@firma.com" />
          </div>
          <label htmlFor="ce-is-primary" style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 13, fontWeight: 500 }}>
            <input id="ce-is-primary" type="checkbox" checked={contactForm.is_primary} onChange={(event) => setContactForm((prev) => ({ ...prev, is_primary: event.target.checked }))} style={{ accentColor: COLORS.primary }} />
            Birincil yetkili olarak işaretle
          </label>
          <label htmlFor="ce-notes" style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Notlar</span>
            <textarea id="ce-notes" value={contactForm.notes} onChange={(event) => setContactForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Yetkili ile ilgili kısa not" rows={3} style={{ width: "100%", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, padding: "8px 10px", background: '#1a1a1a', color: COLORS.text, resize: "vertical" }} />
          </label>
          {contactEditError ? (
            <div style={{ 
              padding: '10px 12px', 
              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
              border: `1px solid ${COLORS.danger}`, 
              borderRadius: RADIUS.md,
              color: COLORS.danger,
              fontSize: 13
            }}>
              <span style={{ fontWeight: 600 }}>Hata: </span>{contactEditError}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
            <Button type="button" variant="ghost" onClick={() => setContactEditOpen(false)}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={contactUpdating}>{contactUpdating ? "Güncelleniyor..." : "Güncelle"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addressCreateOpen}
        onClose={() => setAddressCreateOpen(false)}
        title="Yeni Adres Ekle"
        subtitle="Cari hesap için teslimat veya fatura adresi tanımlayın"
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedAccount) return;
          try {
            const created = await crmService.createAddress({ ...addressForm, account_id: selectedAccount.id });
            setAddresses(prev => [...prev, created]);
            setAddressCreateOpen(false);
            setAddressForm({ address_title: "", address_line: "", city: "", district: "", country: "Türkiye", address_type: "MERKEZ", is_primary: false });
            notificationHelpers.success("Adres eklendi.");
          } catch {
            notificationHelpers.error("Adres eklenemedi.");
          }
        }} style={{ display: "grid", gap: 14, padding: "8px 0" }}>
          <Input id="ac-addr-title" label="Adres Başlığı" value={addressForm.address_title} onChange={e => setAddressForm(p => ({...p, address_title: e.target.value}))} placeholder="Örn: Merkez, Depo, Şube" required />
          <Select id="ac-addr-type" label="Adres Tipi" value={addressForm.address_type} onChange={value => setAddressForm(p => ({...p, address_type: value as AddressType}))} options={ADDRESS_TYPE_OPTIONS} />
          <Input id="ac-addr-line" label="Açık Adres" value={addressForm.address_line} onChange={e => setAddressForm(p => ({...p, address_line: e.target.value}))} placeholder="Sokak, No, Kat..." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="ac-addr-city" label="İl" value={addressForm.city} onChange={e => setAddressForm(p => ({...p, city: e.target.value}))} placeholder="İstanbul" />
            <Input id="ac-addr-district" label="İlçe" value={addressForm.district} onChange={e => setAddressForm(p => ({...p, district: e.target.value}))} placeholder="Ümraniye" />
          </div>
          <Input id="ac-addr-country" label="Ülke" value={addressForm.country} onChange={e => setAddressForm(p => ({...p, country: e.target.value}))} placeholder="Türkiye" />
          <label htmlFor="ac-addr-primary" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text }}>
            <input id="ac-addr-primary" type="checkbox" checked={addressForm.is_primary} onChange={e => setAddressForm(p => ({...p, is_primary: e.target.checked}))} />
            Varsayılan adres olarak işaretle
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8 }}>
            <Button type="button" variant="ghost" onClick={() => setAddressCreateOpen(false)}>İptal</Button>
            <Button type="submit" variant="primary">Ekle</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addressEditOpen}
        onClose={() => setAddressEditOpen(false)}
        title="Adresi Düzenle"
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!editingAddress) return;
          try {
            const updated = await crmService.updateAddress(editingAddress.id, addressForm);
            setAddresses(prev => prev.map(a => a.id === updated.id ? updated : a));
            setAddressEditOpen(false);
            notificationHelpers.success("Adres güncellendi.");
          } catch {
            notificationHelpers.error("Adres güncellenemedi.");
          }
        }} style={{ display: "grid", gap: 14, padding: "8px 0" }}>
          <Input id="ae-addr-title" label="Adres Başlığı" value={addressForm.address_title} onChange={e => setAddressForm(p => ({...p, address_title: e.target.value}))} required />
          <Select id="ae-addr-type" label="Adres Tipi" value={addressForm.address_type} onChange={value => setAddressForm(p => ({...p, address_type: value as AddressType}))} options={ADDRESS_TYPE_OPTIONS} />
          <Input id="ae-addr-line" label="Açık Adres" value={addressForm.address_line} onChange={e => setAddressForm(p => ({...p, address_line: e.target.value}))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input id="ae-addr-city" label="İl" value={addressForm.city} onChange={e => setAddressForm(p => ({...p, city: e.target.value}))} />
            <Input id="ae-addr-district" label="İlçe" value={addressForm.district} onChange={e => setAddressForm(p => ({...p, district: e.target.value}))} />
          </div>
          <Input id="ae-addr-country" label="Ülke" value={addressForm.country} onChange={e => setAddressForm(p => ({...p, country: e.target.value}))} />
          <label htmlFor="ae-addr-primary" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text }}>
            <input id="ae-addr-primary" type="checkbox" checked={addressForm.is_primary} onChange={e => setAddressForm(p => ({...p, is_primary: e.target.checked}))} />
            Varsayılan adres
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8 }}>
            <Button type="button" variant="ghost" onClick={() => setAddressEditOpen(false)}>İptal</Button>
            <Button type="submit" variant="primary">Güncelle</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Form Önizleme Modalı
function FormPreviewModal({ open, onClose, formData }: { open: boolean; onClose: () => void; formData: AccountFormState }) {
  const getAccountTypeLabel = (type: string) => {
    const option = ACCOUNT_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  };

  const getTaxIdTypeLabel = (type: string) => {
    const option = TAX_ID_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  };

  return (
    <Modal open={open} onClose={onClose} title="Form Önizleme" subtitle="Girilen bilgileri kontrol edin" wide>
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 0' }}>
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Genel Bilgiler */}
          <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', color: COLORS.primary, fontSize: 14, fontWeight: 600 }}>Genel Bilgiler</h4>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div><strong>Firma Adı:</strong> {formData.company_name || '-'}</div>
              <div><strong>Hesap Tipi:</strong> {getAccountTypeLabel(formData.account_type)}</div>
              <div><strong>Telefon:</strong> {formData.phone || '-'}</div>
              <div><strong>E-posta:</strong> {formData.email || '-'}</div>
              <div><strong>Web Sitesi:</strong> {formData.website || '-'}</div>
              <div><strong>Sektör:</strong> {formData.industry || '-'}</div>
              <div><strong>Etiketler:</strong> {formData.tags || '-'}</div>
            </div>
          </div>

          {/* Vergi Bilgileri */}
          <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', color: COLORS.primary, fontSize: 14, fontWeight: 600 }}>Vergi Bilgileri</h4>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div><strong>Kimlik Tipi:</strong> {getTaxIdTypeLabel(formData.tax_id_type)}</div>
              <div><strong>{formData.tax_id_type === 'TCKN' ? 'TC Kimlik No:' : 'Vergi No:'}</strong> {formData.tax_id || '-'}</div>
              <div><strong>Vergi Dairesi:</strong> {formData.tax_office || '-'}</div>
              <div><strong>Adres:</strong> {formData.address || '-'}</div>
              <div><strong>İl:</strong> {formData.city || '-'}</div>
              <div><strong>İlçe:</strong> {formData.district || '-'}</div>
              <div><strong>Ülke:</strong> {formData.country || '-'}</div>
            </div>
          </div>

          {/* Finansal Bilgiler */}
          <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', color: COLORS.primary, fontSize: 14, fontWeight: 600 }}>Finansal Bilgiler</h4>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div><strong>Kredi Limiti:</strong> {formData.credit_limit ? `₺${formData.credit_limit}` : '-'}</div>
              <div><strong>Vade (Gün):</strong> {formData.payment_term_days || '-'}</div>
              <div><strong>Minimum Sipariş:</strong> {formData.min_order_amount ? `₺${formData.min_order_amount}` : '-'}</div>
              <div><strong>İskonto Oranı:</strong> {formData.discount_rate ? `%${formData.discount_rate}` : '-'}</div>
              <div><strong>Plaka Birim Fiyat:</strong> {formData.plaka_birim_fiyat ? `₺${formData.plaka_birim_fiyat}` : '-'}</div>
              <div><strong>Bant Metre Fiyat:</strong> {formData.bant_metre_fiyat ? `₺${formData.bant_metre_fiyat}` : '-'}</div>
            </div>
          </div>

          {/* Notlar */}
          {formData.notes && (
            <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
              <h4 style={{ margin: '0 0 12px 0', color: COLORS.primary, fontSize: 14, fontWeight: 600 }}>Notlar</h4>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{formData.notes}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <Button type="button" variant="ghost" onClick={onClose}>Kapat</Button>
      </div>
    </Modal>
  );
}

















