import enum


# Veritabanı enum tipleriyle eşleşen Python enumları
class OrderStatusEnum(str, enum.Enum):
    NEW = "NEW"
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    HOLD = "HOLD"  # Bekletilen durum - 2 hafta
    IN_PRODUCTION = "IN_PRODUCTION"
    READY = "READY"
    COMPLETED = "COMPLETED"
    DELIVERED = "DELIVERED"
    DONE = "DONE"
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"


# ── CRM Enum Tipleri ──
class OpportunityStageEnum(str, enum.Enum):
    LEAD = "LEAD"
    QUALIFIED = "QUALIFIED"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"


class QuoteStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    REVISED = "REVISED"


class TaskPriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskStatusEnum(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class ActivityTypeEnum(str, enum.Enum):
    CALL = "CALL"
    EMAIL = "EMAIL"
    MEETING = "MEETING"
    NOTE = "NOTE"
    TASK = "TASK"


class SyncStatusEnum(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class SyncDirectionEnum(str, enum.Enum):
    PUSH = "PUSH"
    PULL = "PULL"
    BIDIRECTIONAL = "BIDIRECTIONAL"


class IntegrationTypeEnum(str, enum.Enum):
    MIKRO = "MIKRO"
    SMTP = "SMTP"
    SMS = "SMS"
    EINVOICE = "EINVOICE"
    CARGO = "CARGO"
    PAYMENT_GATEWAY = "PAYMENT_GATEWAY"
    WHATSAPP = "WHATSAPP"
    ERP = "ERP"


# ── Tahsilat Enum Tipleri ──
class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"  # Ödeme Bekliyor
    PARTIAL = "PARTIAL"  # Kısmi Ödendi
    PAID = "PAID"  # Tamamen Ödendi
    OVERDUE = "OVERDUE"  # Vadesi Geçti
    CANCELLED = "CANCELLED"  # İptal Edildi


class PaymentMethodEnum(str, enum.Enum):
    CASH = "CASH"  # Nakit
    CARD = "CARD"  # Kredi Kartı
    TRANSFER = "TRANSFER"  # Havale/EFT
    CHECK = "CHECK"  # Çek
    DEBIT = "DEBIT"  # Cari Hesaptan


class ReminderTypeEnum(str, enum.Enum):
    EMAIL = "EMAIL"  # E-posta hatırlatması
    SMS = "SMS"  # SMS hatırlatması
    IN_APP = "IN_APP"  # Uygulama içi hatırlatma
    LETTER = "LETTER"  # Mektup/Faks


class ReminderStatusEnum(str, enum.Enum):
    PENDING = "PENDING"  # Gönderilmesi bekleniyor
    SENT = "SENT"  # Gönderildi
    READ = "READ"  # Okundu
    IGNORED = "IGNORED"  # Göz ardı edildi
    BOUNCED = "BOUNCED"  # Geri döndü (invalid e-posta vb.)


class DealerTypeEnum(str, enum.Enum):
    DEALER = "DEALER"  # Bayi
    B2B = "B2B"  # Kurumsal Müşteri
    B2C = "B2C"  # Bireysel Müşteri
    PROJECT = "PROJECT"  # Proje Müşterisi
    MANUFACTURER = "MANUFACTURER"  # Üretici


class PartGroupEnum(str, enum.Enum):
    GOVDE = "GOVDE"
    ARKALIK = "ARKALIK"


class GrainDirectionEnum(str, enum.Enum):
    ZERO = "0-Material"
    BOYUNA = "1-Boyuna"
    ENINE = "2-Enine"


class IncomingSpecStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    NO_MATCH = "NO_MATCH"


class OptiJobStateEnum(str, enum.Enum):
    NEW = "NEW"
    PREPARED = "PREPARED"  # AGENT_ONEFILE §G2: parca donusum kurallari uygulandi
    OPTI_IMPORTED = "OPTI_IMPORTED"
    OPTI_RUNNING = "OPTI_RUNNING"
    OPTI_DONE = "OPTI_DONE"
    XML_READY = "XML_READY"
    DELIVERED = "DELIVERED"
    DONE = "DONE"
    HOLD = "HOLD"
    FAILED = "FAILED"


class OptiModeEnum(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"


class PriceJobStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
