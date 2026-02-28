import re
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import GrainDirectionEnum, PartGroupEnum


# --- Legacy/Shared Schemas ---
class PartBase(BaseModel):
    part_group: PartGroupEnum
    material_name: str
    thickness_mm: float
    length_mm: float
    width_mm: float
    quantity: int
    grain: Optional[GrainDirectionEnum] = GrainDirectionEnum.ZERO
    edge_banding_u1: Optional[str] = None
    edge_banding_u2: Optional[str] = None
    edge_banding_k1: Optional[str] = None
    edge_banding_k2: Optional[str] = None
    description: Optional[str] = None


class PartCreate(PartBase):
    pass


class Part(PartBase):
    id: int
    order_id: int
    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class Customer(CustomerBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class StationBase(BaseModel):
    name: str
    description: Optional[str] = None


class StationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    device_type: Optional[str] = None
    device_model: Optional[str] = None
    device_serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    connection_type: Optional[str] = None
    installation_date: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None


class Station(StationBase):
    id: int
    active: bool = True
    last_scan_at: Optional[datetime] = None
    scan_count_today: int = 0
    istasyon_durumu: str = "Hazır"
    # Cihaz alanları
    device_type: Optional[str] = None
    device_model: Optional[str] = None
    device_serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    connection_type: Optional[str] = None
    installation_date: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class StatusLogBase(BaseModel):
    part_id: int
    station_id: int
    status: str
    log_message: Optional[str] = None


class StatusLogCreate(StatusLogBase):
    pass


class StatusLog(StatusLogBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class MessageBase(BaseModel):
    customer_id: int
    order_id: int
    template_name: str
    status: str


class MessageCreate(MessageBase):
    pass


class Message(MessageBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class GrainType(str, Enum):
    AUTO = "0-Material"
    LENGTH = "1-Material"
    WIDTH = "2-Material"
    MIXED = "3-Material"


# --- Order Router Schemas ---

VALID_GRAIN_CODES = {"0-Material", "1-Material", "2-Material", "3-Material"}
VALID_PART_GROUPS = {"GOVDE", "ARKALIK"}
VALID_THICKNESSES = {4, 5, 8, 18}


class OrderPartCreate(BaseModel):
    part_group: str
    boy_mm: float
    en_mm: float
    adet: int = 1
    grain_code: str = "0-Material"
    u1: bool = False
    u2: bool = False
    k1: bool = False
    k2: bool = False
    part_desc: Optional[str] = None
    drill_code_1: Optional[str] = None
    drill_code_2: Optional[str] = None

    @field_validator("part_group")
    @classmethod
    def validate_part_group(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in VALID_PART_GROUPS:
            raise ValueError(
                f"part_group '{v}' geçersiz. İzin verilen: {', '.join(sorted(VALID_PART_GROUPS))}"
            )
        return v

    @field_validator("boy_mm")
    @classmethod
    def validate_boy_mm(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("boy_mm 0'dan büyük olmalı")
        if v > 5000:
            raise ValueError("boy_mm 5000 mm'den büyük olamaz")
        return v

    @field_validator("en_mm")
    @classmethod
    def validate_en_mm(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("en_mm 0'dan büyük olmalı")
        if v > 5000:
            raise ValueError("en_mm 5000 mm'den büyük olamaz")
        return v

    @field_validator("adet")
    @classmethod
    def validate_adet(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("adet 0'dan büyük olmalı")
        if v > 9999:
            raise ValueError("adet 9999'dan büyük olamaz")
        return v

    @field_validator("grain_code")
    @classmethod
    def validate_grain_code(cls, v: str) -> str:
        if v not in VALID_GRAIN_CODES:
            raise ValueError(
                f"grain_code '{v}' geçersiz. İzin verilen: {', '.join(sorted(VALID_GRAIN_CODES))}"
            )
        return v

    @model_validator(mode="after")
    def validate_arkalik_no_band(self):
        """Arkalık parçalarında bant olamaz (Handoff §0.4)."""
        if self.part_group == "ARKALIK" and any([self.u1, self.u2, self.k1, self.k2]):
            raise ValueError("Arkalıkta bant olamaz (Handoff §0.4)")
        return self


class OrderPartOut(OrderPartCreate):
    id: str
    order_id: int | str
    model_config = ConfigDict(from_attributes=True)


class OrderCreate(BaseModel):
    customer_id: int
    phone_norm: str
    thickness_mm: float
    plate_w_mm: float
    plate_h_mm: float
    color: str
    material_name: str
    band_mm: Optional[float] = None
    grain_default: str = "0-Material"
    parts: List[OrderPartCreate]

    @field_validator("thickness_mm")
    @classmethod
    def validate_thickness(cls, v: float) -> float:
        if v not in VALID_THICKNESSES:
            raise ValueError(
                f"Kalınlık {v} geçersiz. İzin verilen: {', '.join(str(t) for t in sorted(VALID_THICKNESSES))}"
            )
        return v

    @field_validator("plate_w_mm")
    @classmethod
    def validate_plate_w(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("plate_w_mm 0'dan büyük olmalı")
        return v

    @field_validator("plate_h_mm")
    @classmethod
    def validate_plate_h(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("plate_h_mm 0'dan büyük olmalı")
        return v

    @field_validator("phone_norm")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\(\)\+]", "", v)
        if not cleaned or not cleaned.isdigit():
            raise ValueError("Geçersiz telefon numarası formatı")
        if len(cleaned) < 10:
            raise ValueError("Telefon numarası en az 10 haneli olmalı")
        return v

    @field_validator("grain_default")
    @classmethod
    def validate_grain_default(cls, v: str) -> str:
        if v not in VALID_GRAIN_CODES:
            raise ValueError(f"grain_default '{v}' geçersiz")
        return v

    @field_validator("parts")
    @classmethod
    def validate_parts_not_empty(cls, v: List) -> List:
        if not v:
            raise ValueError("Sipariş en az 1 parça içermelidir")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Renk boş olamaz")
        return v.strip()

    @field_validator("material_name")
    @classmethod
    def validate_material_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Malzeme adı boş olamaz")
        return v.strip()


class OrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    crm_name_snapshot: Optional[str] = None
    phone_norm: Optional[str] = None
    thickness_mm: Optional[float] = None
    plate_w_mm: Optional[float] = None
    plate_h_mm: Optional[float] = None
    color: Optional[str] = None
    material_name: Optional[str] = None
    band_mm: Optional[float] = None
    grain_default: Optional[str] = None
    status: Optional[str] = None


class OrderOut(BaseModel):
    id: str
    order_no: Optional[int] = None
    customer_id: int
    phone_norm: str
    status: str
    thickness_mm: float
    plate_w_mm: float
    plate_h_mm: float
    color: str
    material_name: str
    band_mm: Optional[float] = None
    grain_default: str
    crm_name_snapshot: Optional[str] = None
    ts_code: str
    tracking_token: Optional[str] = None
    parts: List[OrderPartOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OrderListItem(BaseModel):
    """Liste endpoint'i için hafif sipariş — parça dizisi yerine sadece sayı."""

    id: str
    order_no: Optional[int] = None
    customer_id: int
    phone_norm: str
    status: str
    thickness_mm: float
    plate_w_mm: float
    plate_h_mm: float
    color: str
    material_name: str
    band_mm: Optional[float] = None
    grain_default: str
    crm_name_snapshot: Optional[str] = None
    ts_code: str
    tracking_token: Optional[str] = None
    parts_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OrderListResponse(BaseModel):
    data: List[OrderListItem]
    total: int
    page: int


class ValidationError(BaseModel):
    field: str
    message: str
    row: Optional[int] = None


class MergeSuggestion(BaseModel):
    rows: List[int]
    reason: str
    band_match: bool = False


class ValidationResult(BaseModel):
    valid: bool
    errors: List[ValidationError] = []
    merge_suggestions: List[MergeSuggestion] = []


class ExportFile(BaseModel):
    filename: str
    part_group: str
    path: str
    download_url: str


class ExportResult(BaseModel):
    files: List[ExportFile]


# --- Auth Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginUser(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    role: str
    email: Optional[str] = None
    is_active: bool = True
    crm_account_id: Optional[str] = None
    created_at: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    user: LoginUser


# --- Product / Master Data Schemas ---


class BrandCreate(BaseModel):
    code: str
    name: str


class BrandOut(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class ColorCreate(BaseModel):
    code: str
    name: str


class ColorOut(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class ProductTypeCreate(BaseModel):
    code: str
    short_code: str
    name: str


class ProductTypeOut(BaseModel):
    id: int
    code: str
    short_code: str
    name: str
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class MaterialSpecCreate(BaseModel):
    product_type_id: int
    color_id: int
    thickness_mm: float
    width_cm: float
    height_cm: float


class MaterialSpecOut(BaseModel):
    id: int
    product_type_id: int
    color_id: int
    thickness_mm: float
    width_cm: float
    height_cm: float
    spec_code: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class SupplierItemCreate(BaseModel):
    spec_id: int
    brand_id: int
    display_name: Optional[str] = None
    is_default: bool = False
    priority: int = 0


class SupplierItemOut(BaseModel):
    id: int
    spec_id: int
    brand_id: int
    display_name: Optional[str] = None
    is_default: bool = False
    priority: int = 0
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class ItemCreate(BaseModel):
    supplier_item_id: int
    unit: str = "ADET"
    vat_rate: float = 20.0
    default_price: Optional[float] = None
    barcode: Optional[str] = None
    mikro_stok_kodu: Optional[str] = None


class ItemOut(BaseModel):
    id: int
    code: str
    supplier_item_id: int
    unit: str = "ADET"
    vat_rate: float = 20.0
    default_price: Optional[float] = None
    barcode: Optional[str] = None
    mikro_stok_kodu: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class SpecSearchQuery(BaseModel):
    """Spec-first arama parametreleri"""

    query: Optional[str] = None  # Serbest metin arama (ör: "BEYAZ 18")
    product_type_id: Optional[int] = None
    color_id: Optional[int] = None
    thickness_mm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class SpecSearchResult(BaseModel):
    spec: MaterialSpecOut
    product_type: ProductTypeOut
    color: ColorOut
    supplier_items: List[SupplierItemOut] = []
    match_status: str = "MATCHED"  # MATCHED, AMBIGUOUS, NO_MATCH


class IncomingSpecCreate(BaseModel):
    external_line_id: Optional[str] = None
    product_type_short: Optional[str] = None
    color_text: Optional[str] = None
    thickness_mm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class IncomingSpecOut(BaseModel):
    id: int
    external_line_id: Optional[str] = None
    product_type_short: Optional[str] = None
    color_text: Optional[str] = None
    thickness_mm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    status: str = "PENDING"
    chosen_brand_id: Optional[int] = None
    chosen_item_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ProductRequestCreate(BaseModel):
    product_type_short: Optional[str] = None
    color_text: Optional[str] = None
    thickness_mm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    notes: Optional[str] = None


class ProductRequestOut(BaseModel):
    id: int
    spec_hash: Optional[str] = None
    product_type_short: Optional[str] = None
    color_text: Optional[str] = None
    thickness_mm: Optional[float] = None
    status: str = "OPEN"
    resolved_item_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- Orchestrator Job Schemas ---


class OptiJobPartInput(BaseModel):
    id: str
    part_type: str  # GOVDE | ARKALIK
    material_code: str
    length_cm: float
    width_cm: float
    quantity: int
    grain: int = 0  # 0/1/2/3
    color: str
    thickness_mm: float
    edge_up: Optional[str] = None
    edge_lo: Optional[str] = None
    edge_sx: Optional[str] = None
    edge_dx: Optional[str] = None
    iidesc: Optional[str] = None
    desc1: Optional[str] = None
    delik_kodu: Optional[str] = None


class OptiJobCreate(BaseModel):
    order_id: int
    customer_phone: str
    customer_snapshot_name: Optional[str] = None
    opti_mode: Optional[str] = "C"  # A/B/C
    plate_width_mm: Optional[float] = None
    plate_height_mm: Optional[float] = None
    parts: List[OptiJobPartInput]


class OptiAuditEventOut(BaseModel):
    id: int
    job_id: str
    event_type: str
    message: Optional[str] = None
    details_json: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OptiJobOut(BaseModel):
    id: str
    order_id: int
    state: str
    opti_mode: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    events: List[OptiAuditEventOut] = []
    model_config = ConfigDict(from_attributes=True)


class OptiJobListResponse(BaseModel):
    jobs: List[OptiJobOut]
    total: int


# ═══════════════════════════════════════════════════
# WHATSAPP ŞEMALARI
# ═══════════════════════════════════════════════════


class WhatsAppConfigUpdate(BaseModel):
    """WhatsApp yapılandırma güncelleme isteği"""

    phone_number_id: str = ""
    business_account_id: str = ""
    access_token: str = ""
    api_version: str = "v18.0"


class WhatsAppConfigResponse(BaseModel):
    """WhatsApp yapılandırma yanıtı (token gizli)"""

    configured: bool
    phone_number_id: str = ""
    business_account_id: str = ""
    api_version: str = ""


class WhatsAppMessageSend(BaseModel):
    """WhatsApp mesaj gönderme isteği"""

    to_phone: str
    template_name: Optional[str] = None
    message_text: Optional[str] = None
    order_id: Optional[str] = None


class WhatsAppMessageResponse(BaseModel):
    """WhatsApp mesaj yanıtı"""

    id: str
    to_phone: str
    message: str
    status: str  # SENT, FAILED, PENDING
    waba_message_id: Optional[str] = None
    order_id: Optional[str] = None
    order_ts_code: Optional[str] = None
    sent_by: str
    sent_at: str
    error: Optional[str] = None


class WhatsAppTemplateResponse(BaseModel):
    """WhatsApp şablon bilgisi"""

    name: str
    label: str
    body: str
    variables: List[str]


class WhatsAppSummaryResponse(BaseModel):
    """WhatsApp mesaj özeti"""

    configured: bool
    total_sent: int
    today_sent: int
    failed: int
    recent: List[WhatsAppMessageResponse]


class WhatsAppUnreadResponse(BaseModel):
    """Okunmamış mesaj listesi"""

    unread_messages: list
    count: int


# ── Price Tracking Şemaları ──


class PriceUploadJobOut(BaseModel):
    """Fiyat yükleme işi yanıtı"""

    id: str
    status: str
    original_filename: Optional[str] = None
    supplier: str
    rows_extracted: int = 0
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", mode="before")
    @classmethod
    def serialize_created_at(cls, v):
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


def _decimal_to_float(v):
    """Decimal/Numeric → float dönüştürücü."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


class PriceItemOut(BaseModel):
    """Fiyat listesi ürün satırı yanıtı"""

    id: str
    urun_kodu: Optional[str] = None
    urun_adi: str
    birim: str = "ADET"
    boyut: Optional[str] = None
    renk: Optional[str] = None
    liste_fiyati: Optional[float] = None
    iskonto_orani: float = 0
    net_fiyat: Optional[float] = None
    kdv_orani: float = 20
    kdv_dahil_fiyat: Optional[float] = None
    para_birimi: str = "TRY"
    kategori: Optional[str] = None
    marka: Optional[str] = None
    tedarikci: str
    model_config = ConfigDict(from_attributes=True)

    @field_validator(
        "liste_fiyati", "iskonto_orani", "net_fiyat", "kdv_orani", "kdv_dahil_fiyat", mode="before"
    )
    @classmethod
    def coerce_decimal(cls, v):
        return _decimal_to_float(v)


class PriceJobDetailOut(PriceUploadJobOut):
    """Fiyat işi detay yanıtı (ürünlerle birlikte)"""

    items: list[PriceItemOut] = Field(default_factory=list)


class PriceExportRequest(BaseModel):
    """Excel export isteği"""

    job_ids: list[str]


# ── Customer Portal Schemas ──


class PortalDashboardStats(BaseModel):
    active_orders_count: int
    completed_orders_count: int
    total_balance: float
    currency: str = "TRY"


class PortalOrderOut(BaseModel):
    id: str
    status: str
    thickness_mm: float
    color: str
    material_name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_parts: int = 0
    model_config = ConfigDict(from_attributes=True)


class PortalInvoiceOut(BaseModel):
    id: str
    invoice_number: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    total_amount: float
    currency: str = "TRY"
    status: str
    pdf_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Müşteri Destek / Ticket Schemas ──


class PortalTicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: int
    sender_name: Optional[str] = None
    message: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PortalTicketOut(BaseModel):
    id: str
    subject: str
    description: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    messages: List[PortalTicketMessageOut] = []
    model_config = ConfigDict(from_attributes=True)


class PortalTicketCreate(BaseModel):
    subject: str
    description: str
    priority: str = "NORMAL"


class PortalTicketReply(BaseModel):
    message: str


# ── OptiPlanning Advanced Schemas ──


class MachineConfigBase(BaseModel):
    name: str
    description: Optional[str] = None
    saw_thickness: float = 3.2
    trim_top: float = 10.0
    trim_bottom: float = 10.0
    trim_left: float = 10.0
    trim_right: float = 10.0
    advanced_params: Optional[dict] = None
    is_active: bool = True


class MachineConfigCreate(MachineConfigBase):
    pass


class MachineConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    saw_thickness: Optional[float] = None
    trim_top: Optional[float] = None
    trim_bottom: Optional[float] = None
    trim_left: Optional[float] = None
    trim_right: Optional[float] = None
    advanced_params: Optional[dict] = None
    is_active: Optional[bool] = None


class MachineConfigOut(MachineConfigBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OptimizationParamsBase(BaseModel):
    optimization_mode: str = "Standard"  # High Yield, Fast, Standard
    grain_priority: int = 1  # 1: Strict, 0: Ignore
    allow_rotation: bool = True
    spacing_mm: float = 0.0


class OptimizationParamsCreate(OptimizationParamsBase):
    pass


class OptimizationParamsUpdate(BaseModel):
    optimization_mode: Optional[str] = None
    grain_priority: Optional[int] = None
    allow_rotation: Optional[bool] = None
    spacing_mm: Optional[float] = None


class OptimizationParamsOut(OptimizationParamsBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


class OptimizationJobRunRequest(BaseModel):
    order_ids: List[int]
    params: Optional[OptimizationParamsUpdate] = None
    config_name: str = "DEFAULT"


# OptimizationJobOut ve OptimizationReportOut aşağıda Base sınıfları üzerinden tanımlanmıştır


class OptimizationReportBase(BaseModel):
    total_parts: int = 0
    total_boards_used: int = 0
    yield_percentage: float = 0.0
    waste_percentage: float = 0.0
    report_data: Optional[dict] = None


class OptimizationReportOut(OptimizationReportBase):
    id: int
    job_id: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OptimizationJobBase(BaseModel):
    name: str
    status: str = "PENDING"
    format_type: str = "EXCEL"
    related_orders: Optional[List[str]] = None
    result_file_path: Optional[str] = None
    error_message: Optional[str] = None


class OptimizationJobCreate(OptimizationJobBase):
    pass


class OptimizationJobUpdate(BaseModel):
    status: Optional[str] = None
    result_file_path: Optional[str] = None
    error_message: Optional[str] = None


class OptimizationJobOut(OptimizationJobBase):
    id: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    reports: List[OptimizationReportOut] = []
    model_config = ConfigDict(from_attributes=True)
