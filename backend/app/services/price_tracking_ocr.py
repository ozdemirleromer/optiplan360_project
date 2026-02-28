"""
Fiyat takip sistemi — OCR işleme (Tesseract + PIL).
Tesseract OCR: ücretsiz, açık kaynak metin tanıma motoru.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Tesseract yolu yapılandırması ──────────────────────────
_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
]

# Proje-yerel tessdata dizini (Türkçe dil desteği)
_PROJECT_TESSDATA = Path(__file__).resolve().parent.parent.parent / "tessdata"

try:
    import pytesseract
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    HAS_OCR = True

    # Tesseract binary yolunu bul
    for tpath in _TESSERACT_PATHS:
        if os.path.isfile(tpath):
            pytesseract.pytesseract.tesseract_cmd = tpath
            logger.info("Tesseract bulundu: %s", tpath)
            break
    else:
        logger.warning("Tesseract binary bulunamadı, PATH'ten denenecek")

    # Proje-yerel tessdata varsa TESSDATA_PREFIX ayarla
    if _PROJECT_TESSDATA.exists() and any(_PROJECT_TESSDATA.glob("*.traineddata")):
        os.environ["TESSDATA_PREFIX"] = str(_PROJECT_TESSDATA)
        logger.info("TESSDATA_PREFIX ayarlandı: %s", _PROJECT_TESSDATA)

except ImportError:
    HAS_OCR = False
    logger.warning("pytesseract veya Pillow yüklü değil — OCR devre dışı")

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False
    logger.warning("PyMuPDF yüklü değil — PDF→OCR devre dışı")


def preprocess_image(image: "Image.Image") -> "Image.Image":
    """OCR doğruluğu için görüntü ön işleme."""
    img = image.convert("L")  # Grayscale
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.MedianFilter(size=3))  # Denoise
    img = img.point(lambda x: 0 if x < 150 else 255, "1")  # Threshold
    return img


def extract_text_from_image(
    file_path: str,
    lang: str = "tur+eng",
    dpi: int = 300,
) -> str:
    """Tek bir görüntüden OCR ile metin çıkarır."""
    if not HAS_OCR:
        logger.error("OCR kütüphaneleri yüklü değil")
        return ""

    try:
        image = Image.open(file_path)

        # DPI normalizasyonu
        current_dpi = image.info.get("dpi", (72, 72))
        if isinstance(current_dpi, tuple):
            current_dpi = current_dpi[0]
        if current_dpi < dpi:
            scale = dpi / current_dpi
            new_size = (int(image.width * scale), int(image.height * scale))
            max_res = 4096
            if new_size[0] > max_res or new_size[1] > max_res:
                ratio = min(max_res / new_size[0], max_res / new_size[1])
                new_size = (int(new_size[0] * ratio), int(new_size[1] * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        processed = preprocess_image(image)
        text = pytesseract.image_to_string(
            processed, lang=lang, config="--psm 6"
        )
        logger.info("OCR tamamlandı: %d karakter — %s", len(text), file_path)
        return text.strip()

    except Exception as e:
        logger.error("OCR hatası (%s): %s", file_path, e)
        return ""


def extract_text_from_pdf_images(file_path: str, lang: str = "tur+eng") -> str:
    """PDF sayfalarını görüntüye çevirip OCR uygular."""
    if not HAS_FITZ or not HAS_OCR:
        logger.error("PyMuPDF veya pytesseract yüklü değil")
        return ""

    try:
        doc = fitz.open(file_path)
        all_text: list[str] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            processed = preprocess_image(img)
            text = pytesseract.image_to_string(
                processed, lang=lang, config="--psm 6"
            )
            if text.strip():
                all_text.append(text.strip())

        doc.close()
        result = "\n\n".join(all_text)
        logger.info("PDF OCR tamamlandı: %d sayfa — %s", len(all_text), file_path)
        return result

    except Exception as e:
        logger.error("PDF OCR hatası (%s): %s", file_path, e)
        return ""
