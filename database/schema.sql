-- db/schema.sql

-- Özel tiplerin oluşturulması
CREATE TYPE order_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'HOLD', 'IN_PRODUCTION', 'COMPLETED', 'DELIVERED', 'CANCELLED');
CREATE TYPE part_group AS ENUM ('GOVDE', 'ARKALIK');
CREATE TYPE grain_direction AS ENUM ('0-Material', '1-Boyuna', '2-Enine');

-- Müşteri tablosu
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- İstasyonlar tablosu (Ürün Hazırlık, Ebatlama, Bantlama vb.)
CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- Barkod cihazları tablosu (Her istasyondaki okutma cihazları)
CREATE TABLE barcode_devices (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL UNIQUE, -- Cihaz 1, Cihaz 2, Cihaz 3 gibi
    station_id INTEGER NOT NULL REFERENCES stations(id),
    max_scans INTEGER NOT NULL DEFAULT 1, -- EBATLAMA=2, BANTLAMA=1, KONTROL=2
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Siparişler tablosu
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    crm_name_snapshot VARCHAR(255), -- Müşteri adı sipariş anında sabitlenir
    ts_code VARCHAR(50) UNIQUE NOT NULL, -- YYYYMMDD_HHMMSS formatında
    status order_status DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Parçalar tablosu (Her siparişin birden çok parçası olabilir)
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    part_group part_group NOT NULL, -- GOVDE veya ARKALIK
    material_name VARCHAR(255) NOT NULL,
    thickness_mm NUMERIC(5, 2) NOT NULL,
    length_mm NUMERIC(10, 2) NOT NULL,
    width_mm NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    grain grain_direction DEFAULT '0-Material',
    edge_banding_u1 VARCHAR(50),
    edge_banding_u2 VARCHAR(50),
    edge_banding_k1 VARCHAR(50),
    edge_banding_k2 VARCHAR(50),
    description TEXT, -- Delik kodu gibi ek bilgiler
    current_station_id INTEGER REFERENCES stations(id), -- Şu anda hangi istasyonda
    current_status VARCHAR(50), -- Hangi durum aktif (ör: HAZIRLIK, EBATLAMA, vb)
    scan_count INTEGER DEFAULT 0, -- Bu istasyondaki okutma sayısı
    CONSTRAINT chk_arkalik_no_band CHECK (
        part_group != 'ARKALIK' OR (
            edge_banding_u1 IS NULL AND
            edge_banding_u2 IS NULL AND
            edge_banding_k1 IS NULL AND
            edge_banding_k2 IS NULL
        )
    )
);

-- Durum logları tablosu (Her parçanın istasyonlardaki geçmişi)
CREATE TABLE status_logs (
    id SERIAL PRIMARY KEY,
    part_id INTEGER NOT NULL REFERENCES parts(id),
    device_id INTEGER NOT NULL REFERENCES barcode_devices(id), -- Hangi cihazda okutuldu
    station_id INTEGER NOT NULL REFERENCES stations(id),
    scan_number INTEGER NOT NULL, -- 1. okutma mı, 2. okutma mı
    new_status VARCHAR(50) NOT NULL, -- Yeni durum (ör: HAZIRLIK, EBATLAMA)
    status VARCHAR(50) NOT NULL, -- örn: 'SCANNED_SUCCESS', 'SCANNED_FAIL_WRONG_ORDER'
    log_message TEXT,
    is_valid BOOLEAN DEFAULT TRUE, -- 2. okutma 30 dakika kuralı kontrolü
    scan_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    first_scan_timestamp TIMESTAMP WITH TIME ZONE, -- 1. okutmanın zamanı (karşılaştırma için)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sistem logları tablosu (API hataları, genel sistem olayları)
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- INFO, WARNING, ERROR
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Mesajları tablosu
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_id INTEGER REFERENCES orders(id),
    template_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- örn: 'SENT', 'DELIVERED', 'READ', 'FAILED'
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Başlangıç verileri
INSERT INTO stations (name, description) VALUES 
('HAZIRLIK', 'Ürün Hazırlık - Durum: Hazırlandı'), 
('EBATLAMA', 'Ebatlama İşlemi'), 
('BANTLAMA', 'Bantlama İşlemi'), 
('KONTROL', 'Teslimata Hazır'), 
('TESLİMAT', 'Teslimat Yapıldı');

-- Barkod cihazları başlangıç verileri (3 Cihaz → 5 İstasyon)
-- Cihaz 1: 1.okutma → HAZIRLIK (Ürün Hazırlık), 2.okutma → EBATLAMA (Ebatlama İşlemi)
-- Cihaz 2: 1.okutma → BANTLAMA
-- Cihaz 3: 1.okutma → KONTROL (Teslimata Hazır), 2.okutma → TESLİMAT (Teslimat Yapıldı)
-- 30 dk kuralı: 2.okutma 30 dk İÇİNDE yapılırsa GEÇERSİZ
INSERT INTO barcode_devices (device_name, station_id, max_scans) VALUES
('Cihaz 1', 1, 2),  -- HAZIRLIK + EBATLAMA
('Cihaz 2', 3, 1),  -- BANTLAMA
('Cihaz 3', 4, 2);  -- KONTROL + TESLİMAT
