import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.gemini_ocr_adapter import OcrDocumentResult, OcrFieldValue, OcrRowResult, to_workflow_payload


def test_to_workflow_payload_maps_band_fields_into_edge_flags_and_review_metadata():
    result = OcrDocumentResult(
        model_name="gemini-test",
        satirlar=[
            OcrRowResult(
                satir_no=1,
                boy_mm=OcrFieldValue(extracted_value="800", normalized_value=800, confidence_score=94),
                en_mm=OcrFieldValue(extracted_value="600", normalized_value=600, confidence_score=93),
                adet=OcrFieldValue(extracted_value="2", normalized_value=2, confidence_score=95),
                malzeme=OcrFieldValue(extracted_value="18MM BEYAZ", normalized_value="18MM BEYAZ", confidence_score=92),
                bant_1=OcrFieldValue(extracted_value="2MM", normalized_value="2 MM", confidence_score=82, source_text="2MM"),
                bant_2=OcrFieldValue(extracted_value="", normalized_value="", confidence_score=97),
                bant_3=OcrFieldValue(extracted_value="", normalized_value="", confidence_score=96),
                bant_4=OcrFieldValue(extracted_value="2MM", normalized_value="2 MM", confidence_score=84, source_text="2MM"),
                yon=OcrFieldValue(extracted_value="3", normalized_value=3, confidence_score=91),
                delik=OcrFieldValue(extracted_value="", normalized_value="", confidence_score=99),
                parca_adi=OcrFieldValue(extracted_value="YAN", normalized_value="YAN", confidence_score=88),
            )
        ],
    )

    payload = to_workflow_payload(result)
    row = payload["satirlar"][0]
    band_review = row["satir_guven_skor_ozeti"]["band_review"]

    assert row["u1"] is True
    assert row["u2"] is False
    assert row["k1"] is False
    assert row["k2"] is True
    assert row["bant_kalinligi_override"] == "2 MM"
    assert band_review["u1"]["active"] is True
    assert band_review["u1"]["value"] == "2 MM"
    assert band_review["u1"]["confidence"] == 82
    assert band_review["k2"]["active"] is True
    assert band_review["k2"]["source_text"] == "2MM"
