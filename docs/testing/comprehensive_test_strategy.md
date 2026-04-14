# OPTIPLAN 360 — KAPSAMLI TEST VE DOĞRULAMA STRATEJİSİ

---

## 1. GENEL TEST STRATEJİSİ

### 1.1 Test Yaklaşımı
- **Sıfır Tolerans**: Karar dokümanı dışına çıkmayan, katı test yaklaşımı
- **Kapsam Odaklı**: Sadece belirtilen modülleri ve akışları test et
- **Risk Bazlı**: Kritik iş akışları öncelikli, blocker validasyonlar mandatory
- **Contract Sadakati**: Export sözleşmesi birebir doğrulanacak

### 1.2 Test Seviyeleri
- **Unit Test**: Fonksiyonel davranışlar (%80 coverage hedefi)
- **Integration Test**: Servisler arası veri akışı zinciri
- **UI/Workflow Test**: Kullanıcı etkileşim ve blocker mantığı
- **Contract Test**: Export sözleşmesi ve alan eşleşmeleri
- **Regression Test**: Önceki sürümde çalışan akışların bozulmadığı
- **Error/Recovery Test**: Hata senaryoları ve kurtarma akışları

### 1.3 Test Ortamları
- **Dev**: Unit ve integration testleri
- **Staging**: End-to-end workflow testleri
- **Pre-Prod**: Production verisi ile regression testleri

---

## 2. KRİTİK İŞ AKIŞLARI

### 2.1 Ana Akış Zinciri
```
Dosya Al → OCR Havuzu → OCR Kontrol → Sipariş Düzenleme → 
Cari/Stok Eşleme → Validasyon → Birleştirme → Önizleme → 
Export → Mikro SQL → XML/Fire
```

### 2.2 Kritik Blocker Noktaları
- **Phase 2**: %80 confidence altı hücre onayı
- **Phase 3**: Cari/Stok bulunamaması
- **Export**: Validasyon hataları
- **XML/Fire**: Dosya adı eşleşmemesi

### 2.3 Risk Sınıflandırması
- **CRITICAL**: Export sözleşmesi bozulması, veri kaybı
- **HIGH**: Blocker bypass, yanlış veri export
- **MEDIUM**: UI hataları, performans sorunları
- **LOW**: Kozmetik hatalar, loglama eksiklikleri

---

## 3. MODÜL BAZLI TEST SENARYOLARI

---

### 3.1 PHASE 1 — OCR HAVUZU TESTLERİ

#### 3.1.1 Pozitif Senaryolar
```
TC-OCR-001: whatsapp_raw klasörüne .jpg dosya atıldığında algılanmalı
TC-OCR-002: scanner_raw klasörüne .png dosya atıldığında algılanmalı  
TC-OCR-003: manual_raw klasörüne .pdf dosya atıldığında algılanmalı
TC-OCR-004: email_raw klasörüne .jpg dosya atıldığında algılanmalı
TC-OCR-005: İşlem tamamlandığında dosya _arsiv klasörüne taşınmalı
TC-OCR-006: Kayit_UUID doğru oluşturulmalı
TC-OCR-007: Ham_Dosya_Adi doğru kaydedilmeli
TC-OCR-008: Kaynak_Klasor doğru işlenmeli
TC-OCR-009: Dosya_Durumu akışa göre güncellenmeli
TC-OCR-010: OCR ham JSON verisi kaydedilmeli
```

#### 3.1.2 Negatif Senaryolar
```
TC-OCR-011: Aynı isimli dosya tekrar atıldığında overwrite engellenmeli
TC-OCR-012: Desteklenmeyen dosya formatı (.exe) atıldığında reddedilmeli
TC-OCR-013: Bozuk dosya atıldığında hatali_klasorune taşınmalı
TC-OCR-014: Klasör izin hatası olduğunda loglanmalı
TC-OCR-015: Disk dolu olduğunda hata yönetilmeli
```

#### 3.1.3 Edge-Case Senaryolar
```
TC-OCR-016: Sistem yarıda kapanıp yeniden başladığında _islenmis devam etmeli
TC-OCR-017: Çok büyük dosya (>50MB) atıldığında timeout yönetilmeli
TC-OCR-018: Türkçe karakterli dosya adı doğru işlenmeli
TC-OCR-019: Unicode karakterli dosya içeriği doğru işlenmeli
TC-OCR-020: Aynı anda çoklu dosya atıldığında sıralı işlenmeli
```

#### 3.1.4 Validasyon Senaryoları
```
TC-OCR-021: Dosya hash doğru hesaplanmalı
TC-OCR-022: Dosya yolu path injection'a karşı güvenli olmalı
TC-OCR-023: Kaynak_Klasor sadece izinli değerler olmalı
TC-OCR-024: Dosya_Durumu enum değerleri dışına çıkmamalı
```

---

### 3.2 PHASE 2 — OCR KONTROL TESTLERİ

#### 3.2.1 Pozitif Senaryolar
```
TC-CTRL-001: Split-screen layout doğru render edilmeli
TC-CTRL-002: Sol panel görsel sabit kalmalı
TC-CTRL-003: Sağ panel sadece BOY/EN/ADET göstermeli
TC-CTRL-004: %80 altı hücre turuncu renkte gösterilmeli
TC-CTRL-005: %80 ve üstü hücre normal renkte gösterilmeli
TC-CTRL-006: Turuncu hücre onaylanmadan sonraki faza geçiş engellenmeli
TC-CTRL-007: Kullanıcı değer değiştirdiğinde blok kalkmalı
TC-CTRL-008: Satır çıkarıldığında çıkarılanlar listesinde görünmeli
TC-CTRL-009: Çıkarılan satır tekrar dahil edildiğinde aktif olmalı
TC-CTRL-010: Hatalı butonu çalışıp özeti göstermeli
```

#### 3.2.2 Negatif Senaryolar
```
TC-CTRL-011: Malzeme, Grain, Bilgi, Delik alanları görünmemeli
TC-CTRL-012: Turuncu hücre onaylanmadan ilerleme denendiğinde blocker vermeli
TC-CTRL-013: Çıkarılan satır tamamen kaybolmamalı
TC-CTRL-014: Confidence %0-100 dışında değer alırsa hata vermeli
TC-CTRL-015: Hücre boş bırakıldığında varsayılan değer atanmalı
```

#### 3.2.3 Edge-Case Senaryolar
```
TC-CTRL-016: Tüm hücreler %80 altındayda tümü onanana kadar engellenmeli
TC-CTRL-017: Kullanıcı hızlıca değer değiştirip onaylarsa blok kalkmalı
TC-CTRL-018: Çok sayıda satır (>100) olduğunda performans düşmemeli
TC-CTRL-019: Aynı değeri tekrar tekrar değiştirdiğinde audit tutulmalı
TC-CTRL-020: Browser refresh atıldığında son durum korunmalı
```

#### 3.2.4 Validasyon Senaryoları
```
TC-CTRL-021: Confidence sadece 0-100 arası değer almalı
TC-CTRL-022: Hücre değerleri karakter limiti içinde olmalı
TC-CTRL-023: Audit kayıtları eski/yeni değer içermeli
TC-CTRL-024: Çıkarılan satırlar sayısı doğrulanmalı
```

---

### 3.3 PHASE 3 — SİPARİŞ DÜZENLEME TESTLERİ

#### 3.3.1 Pozitif Senaryolar
```
TC-ORDER-001: Üst bar alanları görünürlüğü doğrulanmalı
TC-ORDER-002: Siparis_No varsayılan SIP-000001 formatında gelmeli
TC-ORDER-003: Termin sadece tarih alanı olmalı
TC-ORDER-004: Grid kolonları tam olarak belirtilen listeden oluşmalı
TC-ORDER-005: Yeni satır eklendiğinde varsayılan değerler gelmeli
TC-ORDER-006: Satır silindiğinde pasif kayıt olarak kalmalı
TC-ORDER-007: Plaka_Ref her satırda bulunmalı
TC-ORDER-008: Çoklu plaka açılabilmeli
TC-ORDER-009: Plaka etiketi PLAKA-1 (2100x2800) formatında olmalı
TC-ORDER-010: Fire açıklaması textarea olarak çalışmalı
```

#### 3.3.2 Negatif Senaryolar
```
TC-ORDER-011: Grid'de fazladan kolon görülmemeli
TC-ORDER-012: Grid'de eksik kolon olmamalı
TC-ORDER-013: Termin boş bırakıldığında blocker vermeli
TC-ORDER-014: Aynı Siparis_No tekrarlandığında uyarı vermeli
TC-ORDER-015: Bağlı satır varken plaka silinememeli
TC-ORDER-016: XML/fire aktifken Fire açıklaması boş bırakılamamalı
```

#### 3.3.3 Edge-Case Senaryolar
```
TC-ORDER-017: 100+ satırlı işlemlerde performans test edilmeli
TC-ORDER-018: Plaka değişimi sırasında birleşme yeniden hesaplanmalı
TC-ORDER-019: Siparis_No manuel değiştirildiğinde format korunmalı
TC-ORDER-020: Çoklu plakada satır dağılımı doğru olmalı
```

---

### 3.4 CARİ EŞLEŞME TESTLERİ

#### 3.4.1 Pozitif Senaryolar
```
TC-CARI-001: OCR'dan gelen unvan+telefon ile otomatik eşleşme önerilmeli
TC-CARI-002: Alan tıklandığında arama popup'ı açılmalı
TC-ARI-003: Arama debounce çalışmalı (300ms sonra)
TC-CARI-004: Sonuç listesinde Cari_Kodu, Cari_Unvan, Telefon görünmeli
TC-CARI-005: Tek seçim ile Enter onayı çalışmalı
TC-CARI-006: Seçim sonrası hem kod hem unvan güncellenmeli
TC-CARI-007: Cari_Kodu readonly olmalı
TC-CARI-008: Kayıt bulunamadığında blocker vermeli
```

#### 3.4.2 Negatif Senaryolar
```
TC-CARI-009: Cari_Kodu manuel yazılabilmemeli
TC-CARI-010: Çoklu seçim yapılamamalı
TC-CARI-011: Boş arama sonucu geldiğinde uygun mesaj gösterilmeli
TC-CARI-012: Aynı cari tekrar seçildiğinde hata vermemeli
TC-CARI-013: Arama sonucu yoksa Mikro'da kart aç mesajı gösterilmeli
```

#### 3.4.3 Edge-Case Senaryolar
```
TC-CARI-014: Türkçe karakterli arama sonuç döndürebilmeli
TC-CARI-015: 1000+ cari kaydında performans düşmemeli
TC-CARI-016: Aynı anda çoklu arama yapıldığında sonuç karışmamalı
TC-CARI-017: Network hatasında uygun hata mesajı gösterilmeli
```

---

### 3.5 STOK EŞLEŞME TESTLERİ

#### 3.5.1 Pozitif Senaryolar
```
TC-STOK-001: Kalınlık+Ebat ile otomatik eşleşme önerilmeli
TC-STOK-002: Alan tıklandığında arama popup'ı açılmalı
TC-STOK-003: Arama Kalınlık+Ebat ile başlamalı
TC-STOK-004: Sonuç listesinde Stok_Kodu, Stok_Adi görünmeli
TC-STOK-005: Tek seçim ile Enter onayı çalışmalı
TC-STOK-006: Seçim sonrası Stok_Kodu ve Malzeme güncellenmeli
TC-STOK-007: Stok_Kodu readonly olmalı
TC-STOK-008: Kayıt bulunamadığında blocker vermeli
```

#### 3.5.2 Negatif Senaryolar
```
TC-STOK-009: Stok_Kodu manuel yazılabilmemeli
TC-STOK-010: Çoklu seçim yapılamamalı
TC-STOK-011: Eşleşme yoksa uygun yönlendirme yapılmamalı
TC-STOK-012: Aynı stok tekrar seçildiğinde hata vermemeli
TC-STOK-013: Kalınlık formatı yanlışsa eşleşme olmamalı
```

#### 3.5.3 Edge-Case Senaryolar
```
TC-STOK-014: Ondalık kalınlık değerleri doğru eşleşmeli
TC-STOK-015: 1000+ stok kaydında performans düşmemeli
TC-STOK-016: Ebat formatı farklı şekillerde yazıldığında bulunabilmeli
TC-STOK-017: Network hatasında uygun hata mesajı gösterilmeli
```

---

### 3.6 GRAIN TESTLERİ

#### 3.6.1 Pozitif Senaryolar
```
TC-GRAIN-001: Üst bar sadece 0/1/2/3 seçilebilmeli
TC-GRAIN-002: Grid satırında dropdown ile 0/1/2/3 override yapılabilmeli
TC-GRAIN-003: Export'a integer olarak gitmeli
TC-GRAIN-004: Boş kaldığında varsayılan 3 atanmalı
```

#### 3.6.2 Negatif Senaryolar
```
TC-GRAIN-005: 4, 5, -1, metin değerleri sistemden sızamamalı
TC-GRAIN-006: Boş string kabul edilmemeli
TC-GRAIN-007: Dropdown dışında değer girilememeli
TC-GRAIN-008: Geçersiz değer girildiğinde varsayılan atanmalı
```

#### 3.6.3 Edge-Case Senaryolar
```
TC-GRAIN-009: Üst bar ve grid dropdown senkronize çalışmalı
TC-GRAIN-010: Tüm satırları aynı anda değiştirdiğinde performans düşmemeli
TC-GRAIN-011: Grain değeri export'ta doğru formatta gitmeli
```

---

### 3.7 BANT KALINLIĞI TESTLERİ

#### 3.7.1 Pozitif Senaryolar
```
TC-BANT-001: Üst bar sadece 0.40 MM, 1 MM, 2 MM seçenekleri sunmalı
TC-BANT-002: 0.40 MM → 04 export mapping doğru çalışmalı
TC-BANT-003: 1 MM → 1 export mapping doğru çalışmalı
TC-BANT-004: 2 MM → 2 export mapping doğru çalışmalı
TC-BANT-005: Grid satırında dropdown override çalışmalı
TC-BANT-006: U1/U2/K1/K2 false ise export hücresi boş olmalı
TC-BANT-007: U1/U2/K1/K2 true ise doğru export code yazılmalı
```

#### 3.7.2 Negatif Senaryolar
```
TC-BANT-008: Bu üç değer dışında seçim yapılamamalı
TC-BANT-009: Manuel değer girilememeli
TC-BANT-010: Geçersiz bant kalınlığı kabul edilmemeli
TC-BANT-011: Export mapping yanlışsa hata verilmeli
```

#### 3.7.3 Edge-Case Senaryolar
```
TC-BANT-012: Üst bar ve grid dropdown aynı sözlüğü kullanmalı
TC-BANT-013: Çoklu satır değişiminde performans düşmemeli
TC-BANT-014: U1/U2/K1/K2 kombinasyonları doğru işlenmeli
```

---

### 3.8 BİLGİ / DELİK TESTLERİ

#### 3.8.1 Pozitif Senaryolar
```
TC-BILGI-001: BİLGİ serbest metin kabul etmeli
TC-BILGI-002: BİLGİ karakter sınırı uygulanmalı
TC-BILGI-003: BİLGİ export'a aynen gitmeli
TC-DELIK-001: DELİK-1/DELİK-2 hücre düzenlenebilmeli
TC-DELIK-002: DELİK-1/DELİK-2 sadece rakam validasyonu yapmalı
TC-DELIK-003: DELİK-1/DELİK-2 export'a aynen gitmeli
```

#### 3.8.2 Negatif Senaryolar
```
TC-BILGI-004: BİLGİ karakter limiti aşıldığında kesilmeli
TC-DELIK-004: DELİK-1/DELİK-2 harf girildiğinde reddedilmeli
TC-DELIK-005: DELİK-1/DELİK-2 özel karakter girildiğinde reddedilmeli
TC-DELIK-006: DELİK-1/DELİK-2 negatif sayı girildiğinde reddedilmeli
```

#### 3.8.3 Edge-Case Senaryolar
```
TC-BILGI-005: BİLGİ alanında HTML tag'leri temizlenmeli
TC-DELIK-007: DELİK-1/DELİK-2 çok büyük sayı girildiğinde sınırlandırılmalı
TC-DELIK-008: DELİK-1/DELİK-2 boş bırakıldığında kabul edilmeli
```

---

### 3.9 SATIR EKLEME / SİLME TESTLERİ

#### 3.9.1 Pozitif Senaryolar
```
TC-ROW-001: Manuel satır eklenebilmeli
TC-ROW-002: Yeni satıra varsayılan Malzeme gelmeli
TC-ROW-003: Yeni satıra varsayılan Grain gelmeli
TC-ROW-004: Yeni satıra varsayılan Bant_Kalinligi gelmeli
TC-ROW-005: Yeni satıra aktif Plaka_Ref gelmeli
TC-ROW-006: Satır silindiğinde pasif kayıt olarak kalmalı
TC-ROW-007: OCR ve MANUEL kaynak tipi doğru işlenmeli
```

#### 3.9.2 Negatif Senaryolar
```
TC-ROW-008: Satır silindiğinde tamamen kaybolmamalı
TC-ROW-009: Audit izi korunmalı
TC-ROW-010: Boş satır eklenememeli
TC-ROW-011: Tüm satırlar silindiğinde en az bir satır kalmalı
```

#### 3.9.3 Edge-Case Senaryolar
```
TC-ROW-012: 100+ satır eklendiğinde performans düşmemeli
TC-ROW-013: Hızlı art arda satır eklendiğinde sistem çökmemeli
TC-ROW-014: Silinen satırın referansları düzgün temizlenmeli
```

---

### 3.10 PLAKA YÖNETİMİ TESTLERİ

#### 3.10.1 Pozitif Senaryolar
```
TC-PLAKA-001: Aynı işte birden fazla plaka açılabilmeli
TC-PLAKA-002: PLAKA-1 (2100x2800) formatı doğru olmalı
TC-PLAKA-003: Her satır bir Plaka_Ref taşımalı
TC-PLAKA-004: Yeni satır aktif plakaya bağlanmalı
TC-PLAKA-005: Plaka değişimi onay istemeli
TC-PLAKA-006: Plaka değişince birleşme yeniden hesaplanmalı
TC-PLAKA-007: Plaka listesi sabit liste gelmeli
TC-PLAKA-008: Kullanıcı yeni plaka ekleyebilmeli
TC-PLAKA-009: Kullanıcı plaka düzenleyebilmeli
TC-PLAKA-010: Kullanıcı plaka silebilmeli
```

#### 3.10.2 Negatif Senaryolar
```
TC-PLAKA-011: Bağlı satır varken plaka silinememeli
TC-PLAKA-012: Aynı isimde plaka eklenememeli
TC-PLAKA-013: Plaka boyutları geçersizse kabul edilmemeli
TC-PLAKA-014: Aktif plaka silinemez
```

#### 3.10.3 Edge-Case Senaryolar
```
TC-PLAKA-015: Çoklu plakada satır dağılımı doğru olmalı
TC-PLAKA-016: Plaka değişimi sırasında veri kaybı olmamalı
TC-PLAKA-017: Plaka listesi 100+ item olduğunda performans düşmemeli
```

---

### 3.11 SATIR BİRLEŞTİRME TESTLERİ

#### 3.11.1 Pozitif Senaryolar
```
TC-BIRLES-001: Aynı alanlara sahip satırlar birleşmeli
TC-BIRLES-002: Birleşme sonrası ADET toplanmalı
TC-BIRLES-003: Birleşme Optimizasyona Gönder öncesi çalışmalı
TC-BIRLES-004: Birleşen satırlar önizlemede gösterilmeli
TC-BIRLES-005: Kullanıcı onayı gerekmeli
TC-BIRLES-006: Önizleme ekranında düzenleme engellenmeli
```

#### 3.11.2 Negatif Senaryolar
```
TC-BIRLES-007: Birleşme kriterleri uymuyorsa birleşmemeli
TC-BIRLES-008: Anlık birleşme yapılmamalı
TC-BIRLES-009: Onay alınmadan birleşme tamamlanmamalı
TC-BIRLES-010: Birleşme sonrası veri kaybı olmamalı
```

#### 3.11.3 Edge-Case Senaryolar
```
TC-BIRLES-011: 100+ satır birleştiğinde performans düşmemeli
TC-BIRLES-012: Kısmi eşleşen satırlar doğru gruplanmalı
TC-BIRLES-013: Birleşme iptal edildiğinde orijinal durum dönülmeli
```

---

## 4. POZİTİF SENARYOLAR (GENEL)

### 4.1 Temel Akışlar
```
TC-POS-001: Tam workflow baştan sona çalışabilmeli
TC-POS-002: Tüm fazlar sırasıyla geçilebilmeli
TC-POS-003: Export başarılı olduğunda dosya üretilmeli
TC-POS-004: Mikro SQL'e doğru veri yazılabilmeli
TC-POS-005: XML dosyası doğru oluşturulabilmeli
```

### 4.2 Validasyon Akışları
```
TC-POS-006: Tüm validasyonlar doğru çalışmalı
TC-POS-007: Blocker'lar doğru engellemeli
TC-POS-008: Validasyon geçtikten sonra sonraki faza geçilebilmeli
TC-POS-009: Hata durumları doğru yönetilebilmeli
```

### 4.3 Veri Bütünlüğü
```
TC-POS-010: OCR'dan gelen veri korunabilmeli
TC-POS-011: Kullanıcı değişiklikleri kaydedilebilmeli
TC-POS-012: Audit trail tam olmalı
TC-POS-013: Veri kaybı yaşanmamalı
```

---

## 5. NEGATİF SENARYOLAR (GENEL)

### 5.1 Hata Yönetimi
```
TC-NEG-001: Sistem çökmesinden sonra devam edebilmeli
TC-NEG-002: Network kesintisinde veri kaybolmamalı
TC-NEG-003: Disk dolu olduğunda uygun hata verilmeli
TC-NEG-004: Memory overflow'da sistem çökmemeli
TC-NEG-005: Concurrent access'te veri bozulmamalı
```

### 5.2 Güvenlik
```
TC-NEG-006: SQL injection'a karşı koruma olmalı
TC-NEG-007: XSS attack'a karşı koruma olmalı
TC-NEG-008: Path injection'a karşı koruma olmalı
TC-NEG-009: Yetkisiz erişim engellenmeli
TC-NEG-010: Sensitive data loglanmamalı
```

### 5.3 Performans
```
TC-NEG-011: 1000+ satırda timeout olmamalı
TC-NEG-012: Büyük dosya işleminde memory overflow olmamalı
TC-NEG-013: Concurrent user'da performans düşmemeli
TC-NEG-014: Database connection pool tükenmemeli
```

---

## 6. EDGE-CASE SENARYOLAR (GENEL)

### 6.1 Veri Senaryoları
```
TC-EDGE-001: Türkçe karakterli veriler doğru işlenmeli
TC-EDGE-002: Unicode karakterler korunmalı
TC-EDGE-003: Özel karakterler temizlenmeli
TC-EDGE-004: Çok uzun metinler kesilmeli
TC-EDGE-005: Ondalık sayılar doğru formatlanmalı
```

### 6.2 Kullanıcı Senaryoları
```
TC-EDGE-006: Hızlı tıklandığında sistem karışmamalı
TC-EDGE-007: Browser refresh atıldığında durum korunmalı
TC-EDGE-008: Geri tuşuna basıldığında uygun uyarı verilmeli
TC-EDGE-009: Çoklu tab'da çalışma sorunsuz olmalı
TC-EDGE-010: Mobile browser'da layout bozulmamalı
```

### 6.3 Sistem Senaryoları
```
TC-EDGE-011: Low memory'de graceful degradation olmalı
TC-EDGE-012: High CPU'da timeout yönetilmeli
TC-EDGE-013: Database slow query'de timeout olmalı
TC-EDGE-014: File system permission hatası loglanmalı
```

---

## 7. CONTRACT / EXPORT TESTLERİ

### 7.1 Export Sözleşmesi
```
TC-EXP-001: Excel dosya adı formatı doğru olmalı
TC-EXP-002: CSV dosya adı formatı doğru olmalı
TC-EXP-003: XML dosya adı Excel ile eşleşmeli
TC-EXP-004: Export kolonları tam olarak sözleşmedeki gibi olmalı
TC-EXP-005: Veri tipleri doğru olmalı
TC-EXP-006: Zorunlu alanlar boş gelmemeli
```

### 7.2 Mapping Doğrulaması
```
TC-MAP-001: Bant kalınlığı mapping doğru olmalı
TC-MAP-002: Grain değerleri doğru gitmeli
TC-MAP-003: U1/U2/K1/K2 export code'ları doğru olmalı
TC-MAP-004: Delik değerleri formatlanmalı
TC-MAP-005: Tarih formatları doğru olmalı
TC-MAP-006: Sayı formatları doğru olmalı
```

### 7.3 Dosya Formatları
```
TC-FMT-001: Excel UTF-8 encoding olmalı
TC-FMT-002: CSV delimiter doğru olmalı
TC-FMT-003: XML structure doğru olmalı
TC-FMT-004: File headers doğru olmalı
TC-FMT-005: Line endings doğru olmalı
```

---

## 8. ENTEGRASYON TESTLERİ

### 8.1 Mikro SQL Entegrasyonu
```
TC-MIKRO-001: Cari bilgileri doğru okunabilmeli
TC-MIKRO-002: Stok bilgileri doğru okunabilmeli
TC-MIKRO-003: Header bilgileri doğru yazılabilmeli
TC-MIKRO-004: Satır bilgileri doğru yazılabilmeli
TC-MIKRO-005: Transaction rollback çalışabilmeli
TC-MIKRO-006: Connection error yönetilebilmeli
```

### 8.2 XML/Fire Entegrasyonu
```
TC-XML-001: XML dosya adı eşleşmeli
TC-XML-002: Fire verileri doğru okunabilmeli
TC-XML-003: Fire açıklaması doğru akabilmeli
TC-XML-004: Bozuk XML hata yönetilebilmeli
TC-XML-005: XML structure validasyonu çalışmalı
```

### 8.3 File System Entegrasyonu
```
TC-FS-001: Watcher doğru çalışabilmeli
TC-FS-002: Klasör izinleri doğru olmalı
TC-FS-003: File lock'lar doğru çalışmalı
TC-FS-004: Concurrent file işlemleri yönetilebilmeli
TC-FS-005: Disk space kontrolü çalışmalı
```

---

## 9. REGRESYON TESTLERİ

### 9.1 Kritik Regresyon Alanları
```
TC-REG-001: Confidence blocker mantığı bozulmamalı
TC-REG-002: Cari/Stok eşleme algoritması bozulmamalı
TC-REG-003: Bant mapping bozulmamalı
TC-REG-004: Grain mapping bozulmamalı
TC-REG-005: Export sözleşmesi bozulmamalı
TC-REG-006: Plaka yönetimi bozulmamalı
TC-REG-007: Satır birleştirme bozulmamalı
TC-REG-008: Retry/revizyon akışı bozulmamalı
TC-REG-009: XML dosya adı eşleşmesi bozulmamalı
TC-REG-010: Hata klasörü akışı bozulmamalı
```

### 9.2 UI Regresyonları
```
TC-REG-011: Layout'lar bozulmamalı
TC-REG-012: Buton fonksiyonları bozulmamalı
TC-REG-013: Form validasyonları bozulmamalı
TC-REG-014: Modal pencereler bozulmamalı
TC-REG-015: Grid davranışları bozulmamalı
```

### 9.3 Performans Regresyonları
```
TC-REG-016: Load time'lar artmamalı
TC-REG-017: Memory usage artmamalı
TC-REG-018: Database query time'lar artmamalı
TC-REG-019: File processing time'lar artmamalı
TC-REG-020: API response time'lar artmamalı
```

---

## 10. TESPİT EDİLEN RİSKLER

### 10.1 CRITICAL RİSKLER
```
RISK-001: Export sözleşmesi alan eşleşmesi - Veri kaybı riski
RISK-002: Concurrent file processing - Race condition riski
RISK-003: Database transaction - Veri bütünlüğü riski
RISK-004: Memory management - System crash riski
RISK-005: File system permissions - Data access riski
```

### 10.2 HIGH RİSKLER
```
RISK-006: OCR confidence threshold - Wrong data acceptance risk
RISK-007: Cari/Stok matching - Wrong association risk
RISK-008: Plaka management - Data integrity risk
RISK-009: Satır birleştirme - Data loss risk
RISK-010: Retry/revizyon - Duplicate data risk
```

### 10.3 MEDIUM RİSKLER
```
RISK-011: Performance under load - Timeout risk
RISK-012: Network connectivity - Data loss risk
RISK-013: User error handling - Wrong data entry risk
RISK-014: Browser compatibility - UI functionality risk
RISK-015: Concurrent users - Data conflict risk
```

---

## 11. TEST GAP / BELİRSİZLİKLER

### 11.1 TEST GAP'LER
```
TEST GAP-001: Mikro SQL connection pool configuration belirtilmemiş
TEST GAP-002: Large file (>100MB) processing limit belirtilmemiş
TEST GAP-003: Concurrent user limit belirtilmemiş
TEST GAP-004: Backup/restore strategy belirtilmemiş
TEST GAP-005: Disaster recovery procedure belirtilmemiş
```

### 11.2 BELİRSİZLİKLER
```
UNCERTAIN-001: Fire entegrasyonu zorunlu mu yoksa opsiyonel mi?
UNCERTAIN-002: XML dosya adı formatı nihai mi?
UNCERTAIN-003: Export retry sayısı limiti ne kadar?
UNCERTAIN-004: Audit retention period ne kadar?
UNCERTAIN-005: Performance SLA değerleri ne?
```

---

## 12. CANLIYA ÇIKIŞ ÖNCESİ ZORUNLU KONTROL LİSTESİ

### 12.1 Functionality Checks
```
□ Tüm fazlar sırasıyla çalışabiliyor
□ Blocker'lar doğru engelliyor
□ Validasyonlar doğru çalışıyor
□ Export sözleşmesi birebir eşleşiyor
□ Mikro SQL entegrasyonu sorunsuz
□ XML/Fire entegrasyonu sorunsuz
```

### 12.2 Data Integrity Checks
```
□ OCR verisi korunuyor
□ Kullanıcı değişiklikleri kaydediliyor
□ Audit trail tam
□ Veri kaybı yaşanmıyor
□ Duplicate veri oluşmuyor
```

### 12.3 Performance Checks
```
□ Load time < 3 saniye
□ 100+ satır processing < 30 saniye
□ Memory usage < 1GB
□ Database query time < 1 saniye
□ File processing time < 10 saniye
```

### 12.4 Security Checks
```
□ SQL injection koruması aktif
□ XSS koruması aktif
□ Path injection koruması aktif
□ Authentication çalışıyor
□ Authorization çalışıyor
```

### 12.5 Error Handling Checks
```
□ System crash sonrası devam edebiliyor
□ Network hatası yönetilebiliyor
□ Disk dolu hatası yönetilebiliyor
□ Concurrent access yönetilebiliyor
□ User error'ları uygun yönetiliyor
```

### 12.6 Integration Checks
```
□ File system watcher çalışıyor
□ Database connection sağlam
□ Mikro SQL bağlantısı sağlam
□ XML/Fire entegrasyonu sağlam
□ External API'lar çalışıyor
```

### 12.7 Final Validation
```
□ Tüm test senaryoları geçti
□ Riskler kabul edilebilir seviyede
□ Performance kriterleri karşılandı
□ Security kontrolleri tamam
□ Documentation güncel
□ Backup strategy hazır
□ Monitoring ayarlandı
□ Rollback planı hazır
```

---

## SONUÇ

Bu test stratejisi OptiPlan 360 uygulamasının karar dokümanına sadık kalmasını, kritik iş akışlarının doğru çalışmasını ve production'a çıkmadan önce tüm risklerin tespit edilmesini sağlamak için tasarlanmıştır. Testlerin %100 tamamlanması ve tüm kritik risklerin çözülmesi production'a geçiş için zorunludur.
