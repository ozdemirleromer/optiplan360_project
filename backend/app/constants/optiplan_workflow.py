OPTIPLAN_SOURCE_FOLDERS = {
    "whatsapp_raw": "whatsapp_raw_klasoru",
    "scanner_raw": "scanner_raw_klasoru",
    "manuel_raw": "manuel_raw_klasoru",
    "email_raw": "email_raw_klasoru",
}

OPTIPLAN_ALLOWED_IMPORT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}

# Phase 2 — hücre onay durumlari [SQL-TEKNIK]
OPTIPLAN_CELL_APPROVAL_STATUSES = ("BEKLEMEDE", "ONAYLANDI", "DUZELTILDI")
OPTIPLAN_CELL_APPROVAL_SET = frozenset(OPTIPLAN_CELL_APPROVAL_STATUSES)
OPTIPLAN_CONFIDENCE_THRESHOLD = 80

# Phase 1 — OCR sağlayıcı seçenekleri
OPTIPLAN_OCR_PROVIDERS = ("GEMINI", "TESSERACT", "MANUEL")
OPTIPLAN_OCR_PROVIDER_SET = frozenset(OPTIPLAN_OCR_PROVIDERS)

# Phase 2 — audit islem tipleri
OPTIPLAN_AUDIT_OPERATIONS = (
    "UPDATE", "APPROVE", "REJECT", "REMOVE", "RESTORE", "RETRY",
    "OCR_COMPLETE", "PHASE_TRANSITION", "LOCK", "UNLOCK", "ERROR",
)
OPTIPLAN_AUDIT_OPERATION_SET = frozenset(OPTIPLAN_AUDIT_OPERATIONS)

OPTIPLAN_PHASE2_FIELDS = {"boy", "en", "adet", "malzeme", "grain", "bilgi", "delik_1"}
OPTIPLAN_PHASE2_FIELD_SEQUENCE = ("boy", "en", "adet", "malzeme", "grain", "bilgi", "delik_1")
OPTIPLAN_PHASE2_GATE_FIELDS = ("boy", "en", "adet", "malzeme", "grain", "bilgi", "delik_1")
OPTIPLAN_PHASE2_METADATA_FIELDS = (
    "okunan_cari_unvan",
    "okunan_cari_telefon",
    "ai_guven_skoru_ozeti",
    "revizyon_adayi_uyarisi",
)
OPTIPLAN_PHASE2_ROW_SCORE_KEYS = ("hucre_guven_skorlari", "satir_guven_skor_ozeti")

OPTIPLAN_PHASE3_MUTABLE_FIELDS = (
    "cari_unvan",
    "cari_kodu",
    "siparis_no",
    "teslimat_adresi",
    "odeme_sekli",
    "malzeme",
    "stok_kodu",
    "bant_kalinligi",
    "plaka_boy_mm",
    "plaka_en_mm",
    "fire_aciklamasi",
)

OPTIPLAN_PHASE3_REQUIRED_RECORD_MESSAGES = {
    "cari_kodu": "Cari_Kodu secilmeden ilerlenemez",
    "stok_kodu": "Stok_Kodu secilmeden ilerlenemez",
    "termin": "Termin zorunludur",
    "teslim_tarihi": "Teslim tarihi zorunludur",
    "teslimat_adresi": "Teslimat adresi zorunludur",
    "odeme_sekli": "Odeme sekli zorunludur",
}

OPTIPLAN_PHASE3_ROW_REQUIRED_FIELDS = ("boy", "en", "adet")
OPTIPLAN_PHASE3_ROW_FIELD_LABELS = {
    "boy": "BOY",
    "en": "EN",
    "adet": "ADET",
}
OPTIPLAN_PHASE3_ROW_BOOLEAN_FIELDS = ("u1", "u2", "k1", "k2")
OPTIPLAN_PHASE3_ROW_HOLE_FIELDS = (("delik_1", "DELIK-1"), ("delik_2", "DELIK-2"))
OPTIPLAN_PHASE3_ROW_DEFAULT_SOURCE = "MANUEL"

OPTIPLAN_ALLOWED_ROW_SOURCES = {"OCR", "MANUEL"}

OPTIPLAN_EXPORT_COLUMNS = [
    "[P_CODE_MAT]",
    "[P_LENGTH]",
    "[P_WIDTH]",
    "[P_MINQ]",
    "[P_GRAIN]",
    "[P_IDESC]",
    "[P_EDGE_MAT_UP]",
    "[P_EGDE_MAT_LO]",
    "[P_EDGE_MAT_SX]",
    "[P_EDGE_MAT_DX]",
    "[P_IIDESC]",
    "[P_DESC1]",
]

OPTIPLAN_BAND_EXPORT_MAP = {"0.40 MM": "04", "1 MM": "1", "2 MM": "2"}

OPTIPLAN_ALLOWED_GRAIN_VALUES = {0, 1, 2, 3}

OPTIPLAN_EXPORT_MANIFEST_VERSION = "workflow_export_manifest_v1"
OPTIPLAN_ALLOWED_EXPORT_FORMATS = ("xlsx", "opj")
OPJ_STATUS_VALUES = ("PASIF", "HAZIR_GECICI_V1", "URETILDI_GECICI_V1", "HATA")
OPJ_STATUS_SET = frozenset(OPJ_STATUS_VALUES)
INTERIM_OPJ_WRITER_PROFILE = "interim_opj_v1"
INTERIM_OPJ_CONTRACT_STATE = "draft_interim_v1"


class ExportContractRules:
    """
    Unified export contract specification.
    Single source of truth for all export sözleşme (contract) rules.
    Used by both router response models and service validation guards.
    """

    GRAIN_VALUES = (0, 1, 2, 3)
    GRAIN_SET = frozenset(GRAIN_VALUES)

    EDGE_CODES = ("", "04", "1", "2")
    EDGE_CODES_SET = frozenset(EDGE_CODES)

    HOLE_FIELDS = ("[P_IIDESC]", "[P_DESC1]")
    EDGE_FIELDS = ("[P_EDGE_MAT_UP]", "[P_EGDE_MAT_LO]", "[P_EDGE_MAT_SX]", "[P_EDGE_MAT_DX]")
    NUMERIC_BOUNDED_FIELDS = ("[P_LENGTH]", "[P_WIDTH]", "[P_MINQ]")

    EXPORT_STATUS_VALUES = ("BASARILI", "HATALI", "KISMI_BASARILI")
    EXPORT_STATUS_SET = frozenset(EXPORT_STATUS_VALUES)

    MANIFEST_VERSION = OPTIPLAN_EXPORT_MANIFEST_VERSION

    @staticmethod
    def validate_grain(grain_value: int) -> bool:
        return grain_value in ExportContractRules.GRAIN_SET

    @staticmethod
    def validate_edge_code(edge_code: str) -> bool:
        return edge_code in ExportContractRules.EDGE_CODES_SET

    @staticmethod
    def validate_numeric_bounded(value: int, field_name: str) -> bool:
        return isinstance(value, int) and value >= 1

    @staticmethod
    def validate_hole_field(hole_value: str, field_name: str) -> bool:
        return isinstance(hole_value, str) and (not hole_value or hole_value.isdigit())

    @staticmethod
    def validate_export_status(status: str) -> bool:
        return status in ExportContractRules.EXPORT_STATUS_SET

    __field_requirements__ = {
        "[P_CODE_MAT]": {"type": "str", "required": True, "min_length": 1},
        "[P_LENGTH]": {"type": "int", "required": True, "ge": 1},
        "[P_WIDTH]": {"type": "int", "required": True, "ge": 1},
        "[P_MINQ]": {"type": "int", "required": True, "ge": 1},
        "[P_GRAIN]": {"type": "int", "required": True, "allowed": GRAIN_VALUES},
        "[P_IDESC]": {"type": "str", "required": False},
        "[P_EDGE_MAT_UP]": {"type": "str", "required": False, "allowed": EDGE_CODES},
        "[P_EGDE_MAT_LO]": {"type": "str", "required": False, "allowed": EDGE_CODES},
        "[P_EDGE_MAT_SX]": {"type": "str", "required": False, "allowed": EDGE_CODES},
        "[P_EDGE_MAT_DX]": {"type": "str", "required": False, "allowed": EDGE_CODES},
        "[P_IIDESC]": {"type": "str", "required": False, "pattern": r"^\d*$"},
        "[P_DESC1]": {"type": "str", "required": False, "pattern": r"^\d*$"},
    }


def validate_opj_status(status: str) -> bool:
    return status in OPJ_STATUS_SET

