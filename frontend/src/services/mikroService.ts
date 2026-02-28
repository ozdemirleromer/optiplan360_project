/**
 * Mikro SQL Entegrasyon Servisi
 * /api/v1/mikro endpoints
 */
import { apiRequest } from './apiClient';

interface SettingsUpdateRequest {
  integration_type: string;
  category?: string;
  settings: Record<string, unknown>;
  is_active?: boolean;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

function mikroRequest<T = unknown>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return apiRequest<T>(path, options);
}

// ═══════════════════════════════════════════════════════════
// SAĞLIK KONTROLLERI
// ═══════════════════════════════════════════════════════════

export async function checkHealth() {
  return mikroRequest(`/mikro/health`);
}

// ═══════════════════════════════════════════════════════════
// AYARLAR
// ═══════════════════════════════════════════════════════════

export async function getSettings() {
  return mikroRequest(`/mikro/settings`);
}

export async function updateSettings(data: SettingsUpdateRequest) {
  return mikroRequest(`/mikro/settings`, 'PUT', data);
}

export async function toggleIntegration(integrationType: string, category?: string) {
  const path = `/mikro/settings/${integrationType}/toggle${category ? `?category=${category}` : ''}`;
  return mikroRequest(path, 'POST');
}

// ═══════════════════════════════════════════════════════════
// CARİ HESAP SENKRONIZASYONU
// ═══════════════════════════════════════════════════════════

export async function syncAccount(accountId: string, direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/accounts/${accountId}`,
    'POST',
    { direction }
  );
}

export async function bulkSyncAccounts(accountIds: string[], direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/accounts/bulk`,
    'POST',
    { entity_ids: accountIds, direction }
  );
}

// ═══════════════════════════════════════════════════════════
// FATURA SENKRONIZASYONU
// ═══════════════════════════════════════════════════════════

export async function syncInvoice(invoiceId: string, direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/invoices/${invoiceId}`,
    'POST',
    { direction }
  );
}

export async function bulkSyncInvoices(invoiceIds: string[], direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/invoices/bulk`,
    'POST',
    { entity_ids: invoiceIds, direction }
  );
}

// ═══════════════════════════════════════════════════════════
// TEKLİF SENKRONIZASYONU
// ═══════════════════════════════════════════════════════════

export async function syncQuote(quoteId: string, direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/quotes/${quoteId}`,
    'POST',
    { direction }
  );
}

export async function bulkSyncQuotes(quoteIds: string[], direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/quotes/bulk`,
    'POST',
    { entity_ids: quoteIds, direction }
  );
}

// ═══════════════════════════════════════════════════════════
// SİPARİŞ SENKRONIZASYONU
// ═══════════════════════════════════════════════════════════

export async function syncOrder(orderId: string, direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/orders/${orderId}`,
    'POST',
    { direction }
  );
}

export async function bulkSyncOrders(orderIds: string[], direction: 'PUSH' | 'PULL' = 'PUSH') {
  return mikroRequest(
    `/mikro/sync/orders/bulk`,
    'POST',
    { entity_ids: orderIds, direction }
  );
}

// ═══════════════════════════════════════════════════════════
// MAPPING OPERATIONS
// ═══════════════════════════════════════════════════════════

export async function getEntityMappings(entityType?: string) {
  const path = `/mikro/mappings${entityType ? `?entity_type=${entityType}` : ''}`;
  return mikroRequest(path);
}

export const mikroService = {
  checkHealth,
  getSettings,
  updateSettings,
  toggleIntegration,
  syncAccount,
  bulkSyncAccounts,
  syncInvoice,
  bulkSyncInvoices,
  syncQuote,
  bulkSyncQuotes,
  syncOrder,
  bulkSyncOrders,
  getEntityMappings
};

export default mikroService;
