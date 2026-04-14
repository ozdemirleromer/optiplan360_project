import { test, expect, Page } from '@playwright/test';
import { TestDataFactory, TestHelpers } from './helpers';

/**
 * OptiPlan 360 - Playwright E2E Test Suite
 * OCR Akışı uçtan uca testleri
 * 
 * Coverage:
 * - Phase 1: OCR Havuzu (dosya alma)
 * - Phase 2: OCR Kontrol (confidence, blocker)
 * - Phase 3: Sipariş Düzenleme (cari/stok eşleşme)
 * - Export akışı (önizleme, commit)
 */

// Test fixtures
const testData = new TestDataFactory();

// Page Object Model
class OptiPlanPage {
  constructor(public page: Page) {}

  // Auth
  async login(username: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL(/.*dashboard/);
  }

  // Phase 1: OCR Havuzu
  async navigateToOCRHavuzu() {
    await this.page.click('[data-testid="menu-ocr-havuzu"]');
    await this.page.waitForSelector('[data-testid="ocr-havuzu-page"]');
  }

  async uploadFile(filePath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.click('[data-testid="upload-button"]')
    ]);
    await fileChooser.setFiles(filePath);
  }

  async waitForOCRProcessing(timeout = 30000) {
    await this.page.waitForSelector(
      '[data-testid="ocr-complete"]', 
      { timeout }
    );
  }

  // Phase 2: OCR Kontrol
  async navigateToOCRKontrol(islemId: string) {
    await this.page.goto(`/ocr-control/${islemId}`);
    await this.page.waitForSelector('[data-testid="ocr-control-page"]');
  }

  async getCellConfidence(row: number, col: string): Promise<number> {
    const cell = this.page.locator(
      `[data-testid="cell-${row}-${col}"]`
    );
    const confidenceAttr = await cell.getAttribute('data-confidence');
    return parseFloat(confidenceAttr || '0');
  }

  async isCellOrange(row: number, col: string): Promise<boolean> {
    const cell = this.page.locator(`[data-testid="cell-${row}-${col}"]`);
    const classNames = await cell.getAttribute('class');
    return classNames?.includes('confidence-low') || false;
  }

  async editCell(row: number, col: string, value: string) {
    const cell = this.page.locator(`[data-testid="cell-${row}-${col}"]`);
    await cell.click();
    await cell.fill(value);
    await this.page.keyboard.press('Enter');
  }

  async clickPhase3Button() {
    await this.page.click('[data-testid="proceed-phase-3"]');
  }

  async getBlockerMessage(): Promise<string | null> {
    const blocker = this.page.locator('[data-testid="blocker-message"]');
    if (await blocker.isVisible()) {
      return blocker.textContent();
    }
    return null;
  }

  // Phase 3: Sipariş Düzenleme
  async navigateToSiparisEdit(islemId: string) {
    await this.page.goto(`/order-edit/${islemId}`);
    await this.page.waitForSelector('[data-testid="order-edit-page"]');
  }

  async openCariModal() {
    await this.page.click('[data-testid="cari-unvan-field"]');
    await this.page.waitForSelector('[data-testid="cari-modal"]');
  }

  async searchCari(searchTerm: string) {
    const searchInput = this.page.locator('[data-testid="cari-search"]');
    await searchInput.fill(searchTerm);
    // Debounce bekle
    await this.page.waitForTimeout(400);
  }

  async selectFirstCari() {
    await this.page.click('[data-testid="cari-row-0"]');
    await this.page.keyboard.press('Enter');
  }

  async getCariKodu(): Promise<string> {
    return this.page.inputValue('[data-testid="cari-kodu-field"]');
  }

  async openStokModal() {
    await this.page.click('[data-testid="stok-kodu-field"]');
    await this.page.waitForSelector('[data-testid="stok-modal"]');
  }

  async selectStok(stokKodu: string) {
    await this.page.click(`[data-testid="stok-row-${stokKodu}"]`);
    await this.page.keyboard.press('Enter');
  }

  async setTermin(date: string) {
    await this.page.fill('[data-testid="termin-field"]', date);
  }

  async selectBantKalinligi(value: string) {
    await this.page.selectOption(
      '[data-testid="bant-kalinligi-select"]', 
      value
    );
  }

  async clickOptimizeButton() {
    await this.page.click('[data-testid="optimize-button"]');
  }

  async getPreviewRows(): Promise<number> {
    const rows = this.page.locator('[data-testid="preview-row"]');
    return rows.count();
  }

  async confirmExport() {
    await this.page.click('[data-testid="confirm-export"]');
  }

  // Export sonucu
  async waitForExportSuccess(timeout = 30000) {
    await this.page.waitForSelector(
      '[data-testid="export-success"]',
      { timeout }
    );
  }

  async getExportStatus(): Promise<string> {
    return this.page.textContent('[data-testid="export-status"]') || '';
  }
}

// Test Suite
test.describe('OptiPlan 360 - OCR Workflow', () => {
  let optiPlan: OptiPlanPage;

  test.beforeEach(async ({ page }) => {
    optiPlan = new OptiPlanPage(page);
    await optiPlan.login('admin', 'admin');
  });

  test.describe('Phase 1: OCR Havuzu', () => {
    test('TC-P1-001: Dosya algılama ve kayıt', async ({ page }) => {
      await optiPlan.navigateToOCRHavuzu();
      
      // Test dosyası yükle
      await optiPlan.uploadFile(testData.sampleOCRImage());
      
      // İşleme bekle
      await optiPlan.waitForOCRProcessing();
      
      // Kayıt görünür mü?
      const kayit = page.locator('[data-testid="ocr-kayit-0"]');
      await expect(kayit).toBeVisible();
      
      // Dosya durumu "BEKLIYOR" → "TAMAMLANDI"
      await expect(
        page.locator('[data-testid="status-badge"]')
      ).toHaveText('TAMAMLANDI');
    });

    test('TC-P1-003: Yaşam döngüsü - _islenmis klasörü', async () => {
      // OCR tamamlandıktan sonra dosya _islenmis klasörüne taşınmalı
      // Bu test backend integration testi gerektirir
    });

    test('TC-P1-005: Duplicate kontrol', async ({ page }) => {
      await optiPlan.navigateToOCRHavuzu();
      
      // Aynı dosyayı tekrar yükle
      await optiPlan.uploadFile(testData.sampleOCRImage());
      
      // Duplicate uyarısı
      const warning = page.locator('[data-testid="duplicate-warning"]');
      await expect(warning).toBeVisible();
      await expect(warning).toContainText('Bu dosya daha önce işlendi');
    });
  });

  test.describe('Phase 2: OCR Kontrol', () => {
    test('TC-P2-002: Split-screen yapısı', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // Sol panel (görsel) görünür
      await expect(
        page.locator('[data-testid="left-panel-image"]')
      ).toBeVisible();
      
      // Sağ panel (grid) görünür
      await expect(
        page.locator('[data-testid="right-panel-grid"]')
      ).toBeVisible();
    });

    test('TC-P2-003: Confidence < %80 - Turuncu hücre', async () => {
      const islemId = testData.createMockIslemWithLowConfidence();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // Turuncu hücre kontrolü
      const isOrange = await optiPlan.isCellOrange(0, 'boy');
      expect(isOrange).toBe(true);
      
      // Confidence değeri
      const confidence = await optiPlan.getCellConfidence(0, 'boy');
      expect(confidence).toBeLessThan(80);
    });

    test('TC-P2-004: Confidence >= %80 - Normal hücre', async () => {
      const islemId = testData.createMockIslemWithHighConfidence();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      const isOrange = await optiPlan.isCellOrange(0, 'adet');
      expect(isOrange).toBe(false);
      
      const confidence = await optiPlan.getCellConfidence(0, 'adet');
      expect(confidence).toBeGreaterThanOrEqual(80);
    });

    test('TC-P2-006: Blocker mantığı - geçiş engeli', async () => {
      const islemId = testData.createMockIslemWithLowConfidence();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // Turuncu hücreyi onaylamadan geçmeye çalış
      await optiPlan.clickPhase3Button();
      
      // Blocker mesajı
      const blocker = await optiPlan.getBlockerMessage();
      expect(blocker).toContain('turuncu hücreleri onaylayın');
    });

    test('TC-P2-007: Blocker kalkışı - onay sonrası', async () => {
      const islemId = testData.createMockIslemWithLowConfidence();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // Turuncu hücreyi düzelt
      await optiPlan.editCell(0, 'boy', '2100');
      
      // Şimdi geçiş yapılabilir
      await optiPlan.clickPhase3Button();
      
      // Phase 3 sayfasına yönlendirildi
      await expect(optiPlan.page).toHaveURL(/.*order-edit/);
    });

    test('TC-P2-008: Satır çıkarma', async () => {
      const islemId = testData.createMockIslemWithMultipleRows();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // 2. satırı çıkar
      await optiPlan.page.click('[data-testid="remove-row-1"]');
      
      // Satır pasif mi?
      const row = optiPlan.page.locator('[data-testid="row-1"]');
      await expect(row).toHaveClass(/pasif/);
    });

    test('TC-P2-010: Hatalı butonu', async () => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      // Hatalı butonu tıkla
      await optiPlan.page.click('[data-testid="hatali-button"]');
      
      // Hata modalı açıldı
      await expect(
        optiPlan.page.locator('[data-testid="hata-modal"]')
      ).toBeVisible();
    });
  });

  test.describe('Phase 3: Sipariş Düzenleme', () => {
    test('TC-P3-001: Üst bar alanları görünürlüğü', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Tüm alanlar görünür
      await expect(page.locator('[data-testid="cari-unvan-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="cari-kodu-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="siparis-no-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="termin-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="malzeme-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="stok-kodu-field"]')).toBeVisible();
      await expect(page.locator('[data-testid="bant-kalinligi-select"]')).toBeVisible();
      await expect(page.locator('[data-testid="grain-select"]')).toBeVisible();
    });

    test('TC-P3-002: Grid kolonları doğru set', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      const expectedColumns = [
        'Malzeme', 'BOY', 'EN', 'ADET', 'GRAIN', 
        'BİLGİ', 'U1', 'U2', 'K1', 'K2', 'DELİK-1', 'DELİK-2'
      ];
      
      for (const col of expectedColumns) {
        await expect(
          page.locator(`[data-testid="col-header-${col}"]`)
        ).toBeVisible();
      }
    });

    test('TC-CARI-002: Manuel cari seçim akışı', async () => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Cari modalı aç
      await optiPlan.openCariModal();
      
      // Ara
      await optiPlan.searchCari('ABC');
      
      // İlk sonucu seç
      await optiPlan.selectFirstCari();
      
      // Cari kodu güncellendi mi?
      const cariKodu = await optiPlan.getCariKodu();
      expect(cariKodu).not.toBe('');
    });

    test('TC-CARI-006: Cari_Kodu readonly', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      const cariKoduField = page.locator('[data-testid="cari-kodu-field"]');
      
      // Readonly kontrolü
      await expect(cariKoduField).toHaveAttribute('readonly');
    });

    test('TC-STOK-001: Otomatik stok eşleşme', async () => {
      const islemId = testData.createMockIslemWithStokData();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Stok modalı aç
      await optiPlan.openStokModal();
      
      // Otomatik eşleşme önerisi var mı?
      await expect(
        optiPlan.page.locator('[data-testid="stok-oneri-badge"]')
      ).toBeVisible();
    });

    test('TC-STOK-006: Stok_Kodu readonly', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      const stokKoduField = page.locator('[data-testid="stok-kodu-field"]');
      await expect(stokKoduField).toHaveAttribute('readonly');
    });

    test('TC-P3-005: Termin zorunluluk', async () => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Termin boş bırak
      await optiPlan.setTermin('');
      
      // Kaydetmeye çalış
      await optiPlan.clickOptimizeButton();
      
      // Blocker
      const blocker = await optiPlan.getBlockerMessage();
      expect(blocker).toContain('Termin');
    });
  });

  test.describe('Bant ve Grain Testleri', () => {
    test('TC-GRAIN-001: Üst bar değer seti', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      const grainSelect = page.locator('[data-testid="grain-select"]');
      const options = await grainSelect.locator('option').allTextContents();
      
      expect(options).toContain('0');
      expect(options).toContain('1');
      expect(options).toContain('2');
      expect(options).toContain('3');
      expect(options).not.toContain('4');
    });

    test('TC-BANT-001: UI görünümü - geçerli değerler', async ({ page }) => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      const bantSelect = page.locator('[data-testid="bant-kalinligi-select"]');
      const options = await bantSelect.locator('option').allTextContents();
      
      expect(options).toContain('0.40 MM');
      expect(options).toContain('1 MM');
      expect(options).toContain('2 MM');
    });

    test('TC-BANT-005: U1/U2/K1/K2 false - export boş', async () => {
      // Export preview kontrolü
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // U1, U2, K1, K2 işaretleme
      await optiPlan.page.click('[data-testid="u1-checkbox"]', { clickCount: 0 }); // uncheck
      await optiPlan.page.click('[data-testid="u2-checkbox"]', { clickCount: 0 });
      
      // Preview aç
      await optiPlan.clickOptimizeButton();
      
      // Export değerleri boş olmalı
      const u1Export = await optiPlan.page.textContent('[data-testid="preview-u1-0"]');
      expect(u1Export?.trim()).toBe('');
    });
  });

  test.describe('Export Akışı', () => {
    test('TC-EXPORT-007: Dosya adı formatı', async () => {
      const islemId = testData.createMockIslemWithFullData();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Preview aç
      await optiPlan.clickOptimizeButton();
      
      // Dosya adı kontrolü
      const filename = await optiPlan.page.textContent('[data-testid="export-filename"]');
      
      // Format: MUSTERI_MALZEME_TARIH
      expect(filename).toMatch(/^[A-Z_]+_[0-9]{8}\.xlsx$/);
    });

    test('TC-EXPORT-011: Revizyon dosya adı', async () => {
      const islemId = testData.createMockIslemWithRevision(revNo: 2);
      await optiPlan.navigateToSiparisEdit(islemId);
      
      await optiPlan.clickOptimizeButton();
      
      const filename = await optiPlan.page.textContent('[data-testid="export-filename"]');
      expect(filename).toContain('_v2');
    });

    test('TC-BIRLES-005: Önizleme - birleşen satırlar', async () => {
      const islemId = testData.createMockIslemWithMergeableRows();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      await optiPlan.clickOptimizeButton();
      
      // Preview satır sayısı
      const rowCount = await optiPlan.getPreviewRows();
      
      // Birleşme sonrası satır sayısı azalmalı
      expect(rowCount).toBeLessThan(3); // 2 satır birleşti
    });

    test('TC-EXPORT-001: Ana akış sırası', async () => {
      const islemId = testData.createMockIslemWithFullData();
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // 1. Cari/Stok seç
      await optiPlan.openCariModal();
      await optiPlan.selectFirstCari();
      
      await optiPlan.openStokModal();
      await optiPlan.selectStok('STK001');
      
      // 2. Termin gir
      await optiPlan.setTermin('2026-03-20');
      
      // 3. Preview aç
      await optiPlan.clickOptimizeButton();
      
      // 4. Onayla
      await optiPlan.confirmExport();
      
      // 5. Başarılı
      await optiPlan.waitForExportSuccess();
      
      const status = await optiPlan.getExportStatus();
      expect(status).toContain('BAŞARILI');
    });
  });

  test.describe('Hata / Retry Testleri', () => {
    test('TC-HATA-001: Hatalı butonu - Phase 2', async () => {
      const islemId = testData.createMockIslem();
      await optiPlan.navigateToOCRKontrol(islemId);
      
      await optiPlan.page.click('[data-testid="hatali-button"]');
      
      // Hata modalı
      await expect(
        optiPlan.page.locator('[data-testid="hata-modal"]')
      ).toBeVisible();
      
      // Hata nedeni seç
      await optiPlan.page.selectOption(
        '[data-testid="hata-nedeni-select"]',
        'OCR Hatası'
      );
      
      // Kaydet
      await optiPlan.page.click('[data-testid="hata-kaydet"]');
      
      // İş hatalı klasörüne taşındı
      await expect(
        optiPlan.page.locator('[data-testid="hata-basarili"]')
      ).toBeVisible();
    });

    test('TC-HATA-006: Yeniden işleme - yeni kayıt', async () => {
      // Hatalı işi yeniden işle
      const hataliIslemId = testData.createMockHataliIslem();
      
      await optiPlan.page.goto(`/hatali-islemler`);
      await optiPlan.page.click(`[data-testid="yeniden-isle-${hataliIslemId}"]`);
      
      // Yeni iş oluştu
      await expect(
        optiPlan.page.locator('[data-testid="yeni-is-olustu"]')
      ).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('EC-001: 1000+ satırlı iş performans', async () => {
      const islemId = testData.createMockIslemWithManyRows(1000);
      await optiPlan.navigateToSiparisEdit(islemId);
      
      // Sayfa donmamalı
      await expect(
        optiPlan.page.locator('[data-testid="loading-spinner"]')
      ).not.toBeVisible({ timeout: 5000 });
      
      // Grid yüklenmeli
      await expect(
        optiPlan.page.locator('[data-testid="order-grid"]')
      ).toBeVisible();
    });

    test('EC-005: Eş zamanlı export race condition', async ({ browser }) => {
      const islemId = testData.createMockIslemWithFullData();
      
      // İki ayrı context (farklı kullanıcı)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      const optiPlan1 = new OptiPlanPage(page1);
      const optiPlan2 = new OptiPlanPage(page2);
      
      // Her iki kullanıcı da aynı işe giriş
      await optiPlan1.login('user1', 'pass1');
      await optiPlan2.login('user2', 'pass2');
      
      await optiPlan1.navigateToSiparisEdit(islemId);
      await optiPlan2.navigateToSiparisEdit(islemId);
      
      // İlk kullanıcı lock alır
      // İkinci kullanıcı "işleniyor" mesajı görür
      await expect(
        page2.locator('[data-testid="islem-kilitli-uyarisi"]')
      ).toBeVisible();
    });
  });
});

// Helper sınıfları (test-helpers.ts içinde olmalı)
class TestDataFactory {
  private counter = 0;

  sampleOCRImage(): string {
    return './test-data/sample-ocr.jpg';
  }

  createMockIslem(): string {
    return `islem-${++this.counter}`;
  }

  createMockIslemWithLowConfidence(): string {
    return `islem-low-conf-${++this.counter}`;
  }

  createMockIslemWithHighConfidence(): string {
    return `islem-high-conf-${++this.counter}`;
  }

  createMockIslemWithMultipleRows(): string {
    return `islem-multi-row-${++this.counter}`;
  }

  createMockIslemWithStokData(): string {
    return `islem-stok-${++this.counter}`;
  }

  createMockIslemWithFullData(): string {
    return `islem-full-${++this.counter}`;
  }

  createMockIslemWithRevision(revNo: number): string {
    return `islem-rev-${revNo}-${++this.counter}`;
  }

  createMockIslemWithMergeableRows(): string {
    return `islem-merge-${++this.counter}`;
  }

  createMockIslemWithManyRows(count: number): string {
    return `islem-many-${count}-${++this.counter}`;
  }

  createMockHataliIslem(): string {
    return `islem-hatali-${++this.counter}`;
  }
}
