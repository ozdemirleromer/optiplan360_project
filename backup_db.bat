@ECHO OFF
REM =============================================================================
REM OptiPlan 360 Veritabanı Yedekleme Scripti
REM =============================================================================
REM Bu script, PostgreSQL veritabanını yedekler.
REM 1. Yerel bir klasöre yedekler.
REM 2. Ağdaki bir sunucuya/NAS cihazına kopyalar.
REM 3. İşlem sonuçlarını bir log dosyasına yazar.
REM Windows Task Scheduler ile günlük olarak çalıştırılması önerilir.
REM =============================================================================

REM --- Yedekleme Konfigürasyonu ---
SET PG_HOST=localhost
SET PG_PORT=5432
SET PG_USER=postgres
SET PGPASSWORD=your_postgres_password
SET DB_NAME=optiplan360

REM --- Yedekleme Yolları ---
SET LOCAL_BACKUP_PATH=C:\Backups\OptiPlan360
SET REMOTE_BACKUP_PATH=\\NAS_SERVER\Backups\OptiPlan360
SET LOG_FILE=C:\Backups\OptiPlan360\backup_log.txt

REM --- Dosya Adı ---
SET TIMESTAMP=%DATE:~10,4%-%DATE:~4,2%-%DATE:~7,2%_%TIME:~0,2%-%TIME:~3,2%
SET FILENAME=%DB_NAME%_backup_%TIMESTAMP%.sql

ECHO Yedekleme işlemi başlıyor: %FILENAME% >> %LOG_FILE%

REM --- Klasörlerin varlığını kontrol et ---
IF NOT EXIST "%LOCAL_BACKUP_PATH%" (
    ECHO Yerel yedekleme klasörü oluşturuluyor: %LOCAL_BACKUP_PATH% >> %LOG_FILE%
    MKDIR "%LOCAL_BACKUP_PATH%"
)
IF NOT EXIST "%REMOTE_BACKUP_PATH%" (
    ECHO Uzak yedekleme klasörü oluşturuluyor: %REMOTE_BACKUP_PATH% >> %LOG_FILE%
    MKDIR "%REMOTE_BACKUP_PATH%"
)

REM --- PostgreSQL Yedekleme (pg_dump) ---
ECHO "%LOCAL_BACKUP_PATH%\%FILENAME%" yoluna yedekleniyor... >> %LOG_FILE%
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h %PG_HOST% -p %PG_PORT% -U %PG_USER% -d %DB_NAME% -F c -b -v -f "%LOCAL_BACKUP_PATH%\%FILENAME%"

IF %ERRORLEVEL% NEQ 0 (
    ECHO [HATA] Veritabanı yedekleme başarısız oldu. >> %LOG_FILE%
    EXIT /B 1
) ELSE (
    ECHO Yerel yedekleme başarıyla tamamlandı. >> %LOG_FILE%
)

REM --- Uzak Sunucuya Kopyalama ---
ECHO Yedek dosyası uzak sunucuya kopyalanıyor: %REMOTE_BACKUP_PATH% >> %LOG_FILE%
ROBOCOPY "%LOCAL_BACKUP_PATH%" "%REMOTE_BACKUP_PATH%" "%FILENAME%" /MOV /NFL /NDL /NJH /NJS /nc /ns /np

IF %ERRORLEVEL% EQU 1 OR %ERRORLEVEL% EQU 0 (
    ECHO Uzak sunucuya kopyalama başarıyla tamamlandı. >> %LOG_FILE%
) ELSE (
    ECHO [UYARI] Yedek dosyası uzak sunucuya kopyalanamadı. Hata Kodu: %ERRORLEVEL% >> %LOG_FILE%
)

REM --- Eski Yedekleri Temizle (Opsiyonel, 7 günden eski dosyaları siler) ---
ECHO 7 günden eski yedekler temizleniyor... >> %LOG_FILE%
FORFILES /P "%LOCAL_BACKUP_PATH%" /S /M *.sql /D -7 /C "cmd /c del @path"

ECHO Yedekleme işlemi tamamlandı. >> %LOG_FILE%
