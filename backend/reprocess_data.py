"""Veriyi guncel mapping kurallariyla yeniden isler."""
import io
import pandas as pd
from uuid import uuid4
from app.database import SessionLocal
from app.models import PriceUploadJob, PriceItem
from app.services.price_tracking_helpers import normalize_columns

db = SessionLocal()
job = db.query(PriceUploadJob).first()
if not job:
    print("Job yok!")
    exit()

# Eski itemlari sil
deleted = db.query(PriceItem).filter(PriceItem.job_id == job.id).delete()
print(f"Eski itemlar silindi: {deleted}")

# Dosyayi yeniden isle
df = pd.read_excel(io.BytesIO(job.file_data), engine="openpyxl")
print(f"Excel okundu: {df.shape}")
print(f"Orijinal sutunlar: {list(df.columns)}")

# Normalize et
mapping = normalize_columns(list(df.columns))
print(f"Esleme: {mapping}")
df = df.rename(columns=mapping)

# Duplicate temizle
if not df.columns.is_unique:
    df = df.T.groupby(level=0).last().T
    print("Duplicate temizlendi")

# Sayisal donusum
for col in ("LISTE_FIYATI", "ISKONTO_ORANI", "NET_FIYAT", "KDV_ORANI", "KDV_DAHIL_FIYAT"):
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

# Bos satirlari temizle
if "URUN_ADI" in df.columns:
    df = df.dropna(subset=["URUN_ADI"])
    df = df[df["URUN_ADI"].astype(str).str.strip() != ""]

print(f"Temiz satir: {len(df)}")

# Ilk 3 satirin degerlerini goster
std_cols = ["URUN_KODU", "URUN_ADI", "BIRIM", "LISTE_FIYATI", "NET_FIYAT", "KDV_ORANI"]
print("\n=== ILK 3 SATIR ===")
for idx in range(min(3, len(df))):
    row = df.iloc[idx]
    vals = {c: row.get(c, "N/A") for c in std_cols}
    print(f"  Row {idx}: {vals}")


def safe_float(v, default=None):
    if v is None:
        return default
    try:
        f = float(v)
        return f if not pd.isna(f) else default
    except (ValueError, TypeError):
        return default


# DB'ye yaz
count = 0
for _, row in df.iterrows():
    uk = row.get("URUN_KODU")
    if isinstance(uk, float) and pd.isna(uk):
        uk = None
    else:
        uk = str(uk).strip() if uk is not None else None

    birim_val = row.get("BIRIM", "ADET")
    if isinstance(birim_val, float) and pd.isna(birim_val):
        birim_val = "ADET"
    birim_val = str(birim_val).strip() or "ADET"

    item = PriceItem(
        id=str(uuid4()),
        job_id=job.id,
        urun_kodu=uk,
        urun_adi=str(row.get("URUN_ADI", "")).strip(),
        birim=birim_val,
        liste_fiyati=safe_float(row.get("LISTE_FIYATI")),
        iskonto_orani=safe_float(row.get("ISKONTO_ORANI"), 0),
        net_fiyat=safe_float(row.get("NET_FIYAT")),
        kdv_orani=safe_float(row.get("KDV_ORANI"), 20),
        kdv_dahil_fiyat=safe_float(row.get("KDV_DAHIL_FIYAT")),
        para_birimi=str(row.get("PARA_BIRIMI", "TRY")),
        kategori=str(row.get("KATEGORI", "")) or None,
        marka=str(row.get("MARKA", "")) or None,
        tedarikci=job.supplier,
    )
    db.add(item)
    count += 1

job.rows_extracted = count
db.commit()
print(f"\nYeni itemlar yazildi: {count}")

# Dogrulama
items = db.query(PriceItem).filter(PriceItem.job_id == job.id).limit(3).all()
print("\n=== DOGRULAMA ===")
for it in items:
    print(
        f"  kod={it.urun_kodu!r} adi={it.urun_adi!r} birim={it.birim!r} "
        f"liste={it.liste_fiyati} net={it.net_fiyat} kdv={it.kdv_orani}"
    )
db.close()
print("\nBASARILI!")
