
# OptiPlan 360 Sunucu Kurulum Kılavuzu

Bu kılavuz, OptiPlan 360 uygulamasını bir Windows Server üzerinde canlıya almak için gereken adımları açıklamaktadır.

## 1. Sunucu Gereksinimleri

Kuruluma başlamadan önce sunucunuzun aşağıdaki gereksinimleri karşıladığından emin olun:

- **İşletim Sistemi:** Windows Server 2016 veya üstü.
- **Yazılım:**
  - **PowerShell 5.1** veya üstü.
  - **PostgreSQL 15 veya 16:** [Resmi PostgreSQL İndirme Sayfası](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
  - **Python 3.12:** [Resmi Python İndirme Sayfası](https://www.python.org/downloads/). Kurulum sırasında **"Add Python to PATH"** seçeneğini işaretlediğinizden emin olun.
  - **Node.js 20 (LTS):** [Resmi Node.js İndirme Sayfası](https://nodejs.org/). `npm` komutunun sistem genelinde çalışması için gereklidir.

## 2. IIS (Internet Information Services) Yapılandırması

OptiPlan 360, backend ve frontend'i sunmak için IIS kullanır.

### 2.1. IIS Rolünü Etkinleştirme

1.  **Server Manager**'ı açın.
2.  `Manage` -> `Add Roles and Features` seçeneğine tıklayın.
3.  `Web Server (IIS)` rolünü seçin.
4.  `Role Services` bölümünde, aşağıdaki servislerin seçili olduğundan emin olun:
    - `Common HTTP Features` -> `Static Content`
    - `Application Development` -> `CGI` (Önemli!)
5.  Kurulumu tamamlayın.

### 2.2. Gerekli Modülleri Yükleme

IIS'in Python uygulamalarını ve modern web uygulamalarını çalıştırabilmesi için aşağıdaki iki modülün yüklenmesi **zorunludur**:

1.  **HttpPlatformHandler 1.2:**
    - [Microsoft İndirme Merkezi](https://www.microsoft.com/en-us/download/details.aspx?id=47385)
    - Bu modül, IIS'in Python/FastAPI uygulamasını bir alt işlem olarak çalıştırmasını sağlar.

2.  **URL Rewrite 2.1:**
    - [IIS.net İndirme Sayfası](https://www.iis.net/downloads/microsoft/url-rewrite)
    - Bu modül, React/Vue gibi Single Page Application (SPA) framework'lerinin yönlendirme (routing) işlemlerinin doğru çalışması için gereklidir.

## 3. OptiPlan 360 Kurulumu

1.  `OptiPlan360_Setup.exe` dosyasını sunucuya kopyalayın.
2.  Dosyayı **Yönetici olarak** çalıştırın.
3.  Kurulum sihirbazı, aşağıdaki işlemleri otomatik olarak gerçekleştirecektir:
    - Gerekli Python ve PostgreSQL versiyonlarının yüklü olup olmadığını kontrol eder.
    - Proje kaynak dosyalarını (`frontend`, `backend`, `deploy.ps1` vb.) **`C:\Program Files\OptiPlan360_Source`** klasörüne kopyalar.
    - Arka planda `deploy.ps1` script'ini çalıştırır (bu scriptin kendisi dosyaları `C:\inetpub\wwwroot\optiplan360` altına taşıyacaktır).

## 4. Kurulum Sonrası Manuel Adımlar

**Önemli Not:** `OptiPlan360_Setup.exe` kurulumu `deploy.ps1` script'ini otomatik olarak çalıştırır. Eğer bu script bir hata verirse veya dağıtımı manuel olarak yapmak isterseniz aşağıdaki adımları izleyin.

1.  **PowerShell'i Yönetici olarak açın**.
2.  Kaynak kodların bulunduğu klasöre gidin:
    ```powershell
    cd "C:\Program Files\OptiPlan360_Source"
    ```
3.  Dağıtım script'ini çalıştırın:
    ```powershell
    .\deploy.ps1
    ```

### 4.1. Veritabanı Bağlantısını Yapılandırma

- Dağıtım sonrası oluşan `C:\inetpub\wwwroot\optiplan360\backend\.env` dosyasını bir metin düzenleyici ile açın.
- Aşağıdaki ortam değişkenlerini kendi PostgreSQL ve Mikro sunucu bilgilerinize göre düzenleyin:

  ```
  DATABASE_URL="postgresql://postgres:SENIN_POSTGRES_SIFREN@localhost/optiplan360"
  MIKRO_SERVER="MIKRO_SUNUCU_IP"
  MIKRO_DATABASE="MIKRO_DB_ADI"
  MIKRO_USER="MIKRO_KULLANICI_ADI"
  MIKRO_PASSWORD="MIKRO_SIFRESI"
  ```

- Değişiklik sonrası IIS Manager'ı açın, `OptiPlan360` sitesini seçin ve **Restart** yapın.

### 4.2. Yedekleme Görevini Zamanlama

1.  `C:\Program Files\OptiPlan360_Source\backup_db.bat` dosyasını düzenleyin.
2.  `PGPASSWORD`, `LOCAL_BACKUP_PATH` ve `REMOTE_BACKUP_PATH` değişkenlerini güncelleyin.
3.  **Windows Task Scheduler** (Görev Zamanlayıcı) ile bu script'i günlük çalışacak şekilde zamanlayın.
