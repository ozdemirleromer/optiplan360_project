import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.price_tracking_helpers import SUPPORTED_EXTENSIONS

client = TestClient(app, headers={"Host": "localhost"})

def test_price_tracking_upload_endpoint_exists():
    """
    Upload endpoint'inin varlığını ve 404 döndürmediğini kontrol eder.
    Auth token olmadan 401 dönmesi, endpoint'in var olduğunu gösterir.
    404 dönerse router bağlanmamış demektir.
    """
    # Rastgele bir dosya içeriği
    files = {'file': ('test.xlsx', b'fake content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    data = {'supplier': 'Test Supplier'}
    
    # Auth header olmadan istek atılıyor
    response = client.post("/api/v1/price-tracking/upload", files=files, data=data)
    
    # 404 değilse endpoint vardır (muhtemelen 401 Unauthorized dönecek)
    assert response.status_code != 404, f"Endpoint bulunamadı (404). Router bağlı değil! Yanıt: {response.text}"
    
    # Router bağlıysa 404 DÖNMEMELİDİR.
    # Auth hatası (401/403) veya Validation hatası (422) dönebilir.
    # Önemli olan 404 dönmemesidir.
    assert response.status_code in [401, 403, 422, 201], f"Endpoint bulundu ancak beklenmedik kod döndü: {response.status_code}. (404 sorunu çözüldü!)"

def test_price_tracking_jobs_endpoint_exists():
    """
    Jobs listeleme endpoint'ini kontrol eder.
    """
    response = client.get("/api/v1/price-tracking/jobs")
    assert response.status_code != 404, "Jobs endpoint bulunamadı (404)"
    assert response.status_code == 401, f"Beklenen 401 hatası alınmadı. Yanıt kodu: {response.status_code}"
