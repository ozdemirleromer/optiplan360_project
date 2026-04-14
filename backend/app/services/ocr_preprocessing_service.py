"""
OCR Preprocessing Service — Modüler görüntü ön işleme pipeline'ı.

Her adım bağımsız açılıp kapanabilir.
OpenCV kurulu değilse tüm adımlar sessizce atlanır (fallback: orijinal bytes döner).

KURAL: Bu servis yalnızca görüntü kalitesini artırır.
       İş kuralı ve faz mantığı yoktur.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as _np
    _CV2_AVAILABLE = True
except ImportError:
    cv2 = None  # type: ignore[assignment]
    _np = None  # type: ignore[assignment]
    _CV2_AVAILABLE = False
    logger.info(
        "opencv-python-headless kurulu değil — "
        "OCR preprocessing adımları atlanacak, orijinal bytes gönderilecek"
    )


@dataclass
class PreprocessConfig:
    """Hangi adımların aktif olacağını kontrol eder. Her adım bağımsız."""

    grayscale: bool = True
    clahe_contrast: bool = True       # CLAHE adaptif kontrast iyileştirme
    denoise: bool = True              # Fast NL Means gürültü azaltma
    threshold: bool = False           # Adaptif eşikleme — doğal fotoğraflarda kapalı
    deskew: bool = True               # Metin eğrilik düzeltme
    crop_alignment: bool = False      # Deneysel — henüz aktif değil


@dataclass
class PreprocessResult:
    """Preprocessing çıktısı: geliştirilmiş bytes + uygulanan adımların özeti."""

    enhanced_bytes: bytes
    original_bytes: bytes
    steps_applied: list[str] = field(default_factory=list)
    deskew_angle_deg: float = 0.0
    width_px: int = 0
    height_px: int = 0
    provider: str = "none"
    error: Optional[str] = None

    def to_metadata(self) -> dict:
        return {
            "provider": self.provider,
            "steps_applied": self.steps_applied,
            "deskew_angle_deg": self.deskew_angle_deg,
            "width_px": self.width_px,
            "height_px": self.height_px,
            "error": self.error,
        }


def preprocess_image(
    image_bytes: bytes,
    config: Optional[PreprocessConfig] = None,
    *,
    source_ext: str = ".jpg",
) -> PreprocessResult:
    """
    Görüntü bytes'ini alır, preprocessing uygular, geliştirilmiş bytes döner.

    PDF girdisi: orijinal bytes döner (fallback).
    OpenCV yoksa: orijinal bytes döner (fallback).
    Herhangi bir hata: orijinal bytes döner, hata loglanır.
    """
    cfg = config or PreprocessConfig()

    if source_ext.lower() == ".pdf":
        return PreprocessResult(
            enhanced_bytes=image_bytes,
            original_bytes=image_bytes,
            provider="none",
            error="PDF preprocessing bu sürümde desteklenmiyor — doğrudan Gemini'ye gönderildi",
        )

    if not _CV2_AVAILABLE:
        return PreprocessResult(
            enhanced_bytes=image_bytes,
            original_bytes=image_bytes,
            provider="none",
            error="opencv-python-headless kurulu değil",
        )

    try:
        return _run_cv2_pipeline(image_bytes, cfg)
    except Exception as exc:
        logger.exception("Preprocessing pipeline hatası — orijinal bytes döndürülüyor: %s", exc)
        return PreprocessResult(
            enhanced_bytes=image_bytes,
            original_bytes=image_bytes,
            provider="cv2",
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# İç pipeline adımları
# ---------------------------------------------------------------------------

def _run_cv2_pipeline(image_bytes: bytes, cfg: PreprocessConfig) -> PreprocessResult:
    buf = _np.frombuffer(image_bytes, _np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode başarısız — desteklenmeyen format veya bozuk dosya")

    h, w = img.shape[:2]
    steps: list[str] = []
    deskew_angle = 0.0

    # Adım 1: Grayscale (her zaman uygulanır — renk bilgisi OCR için gereksiz)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if cfg.grayscale:
        steps.append("grayscale")

    # Adım 2: CLAHE adaptif kontrast iyileştirme
    if cfg.clahe_contrast:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        steps.append("clahe_contrast")

    # Adım 3: Gürültü azaltma
    if cfg.denoise:
        gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
        steps.append("denoise")

    # Adım 4: Eğrilik tespiti ve düzeltme
    if cfg.deskew:
        deskew_angle = _compute_skew_angle(gray)
        if abs(deskew_angle) > 0.5:
            gray = _rotate_image(gray, deskew_angle)
            steps.append(f"deskew({deskew_angle:.1f}deg)")

    # Adım 5: Adaptif eşikleme (isteğe bağlı, kapalı varsayılan)
    if cfg.threshold:
        gray = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2,
        )
        steps.append("adaptive_threshold")

    success, encoded = cv2.imencode(".jpg", gray, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise ValueError("cv2.imencode başarısız")

    return PreprocessResult(
        enhanced_bytes=encoded.tobytes(),
        original_bytes=image_bytes,
        steps_applied=steps,
        deskew_angle_deg=deskew_angle,
        width_px=w,
        height_px=h,
        provider="cv2",
    )


def _compute_skew_angle(gray: "_np.ndarray") -> float:
    """Görüntüdeki metin eğrilik açısını Hough dönüşümü ile tahmin eder."""
    try:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, 1, _np.pi / 180,
            threshold=80, minLineLength=100, maxLineGap=10,
        )
        if lines is None:
            return 0.0
        angles = []
        for x1, y1, x2, y2 in lines[:, 0]:
            dx = x2 - x1
            if abs(dx) < 1:
                continue
            angle = _np.degrees(_np.arctan2(y2 - y1, dx))
            if abs(angle) < 45:
                angles.append(float(angle))
        if not angles:
            return 0.0
        return float(_np.median(angles))
    except Exception:
        return 0.0


def _rotate_image(img: "_np.ndarray", angle_deg: float) -> "_np.ndarray":
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), -angle_deg, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
