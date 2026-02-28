import { apiRequest } from "./apiClient";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  name?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
};

export type AuditLog = {
  id: string;
  userId: string;
  username: string;
  action: string;
  targetId?: string | null;
  detail?: string | null;
  createdAt: string;
};

export type StationDto = {
  id: number;
  name: string;
  description?: string | null;
  active?: boolean;
  istasyonDurumu?: string;
  lastScanAt?: string;
  scanCountToday?: number;
  // Cihaz alanları
  deviceType?: string | null;
  deviceModel?: string | null;
  deviceSerialNumber?: string | null;
  ipAddress?: string | null;
  connectionType?: string | null;
  installationDate?: string | null;
  lastMaintenanceDate?: string | null;
  // Legacy fields for backward compatibility
  lastScan?: string;
  todayScans?: number;
};

export type MikroConfig = {
  configured: boolean;
  host: string;
  port: number;
  instance: string;
  database: string;
  username: string;
  password: string;
  timeoutSeconds: number;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

export type SqlQueryResult = {
  columns: string[];
  rows: Array<Array<unknown>>;
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
};

export type SqlTableInfo = {
  name: string;
  rowCount: number;
  columns: string[];
};

export type DeviceConfig = {
  configured: boolean;
  deviceName: string;
};

export type TelegramConfig = {
  configured: boolean;
  allowedChatId: string;
};

export type EmailConfig = {
  configured: boolean;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapMailbox: string;
};

export type WhatsAppConfig = {
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
};

export type OCRConfig = {
  configured: boolean;
  engine: string;
  languages: string[];
  preprocessingEnabled: boolean;
  confidenceThreshold: number;
};

export type SystemStats = {
  totalOrders: number;
  ordersNew: number;
  ordersProduction: number;
  ordersReady: number;
  ordersDelivered: number;
  totalCustomers: number;
  totalUsers: number;
  weeklyLabels: string[];
  weeklyValues: number[];
  materialLabels: string[];
  materialValues: number[];
};

export type SystemConfig = {
  shiftStart: string;
  shiftEnd: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  workingDays: string[];
  holidayPolicy: string;
  orderAutoHoldHours: number;
  maxFileSizeMb: number;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  enableTwoFactor: boolean;
  backupFrequency: string;
  logRetentionDays: number;
  advancedSettings?: AdvancedSystemConfig;
  lastSystemCheckAt?: string | null;
};

export type AdvancedSystemConfig = {
  apiRateLimit: number;
  queueRetryCount: number;
  queueBackoffMs: number;
  dbPoolSize: number;
  dbTimeoutMs: number;
  reportCacheMinutes: number;
  maxParallelJobs: number;
  maintenanceWindow: string;
  disasterRecoveryRegion: string;
  autoScaleEnabled: boolean;
  cpuThreshold: number;
  memoryThreshold: number;
  diskThreshold: number;
  anomalyDetectionEnabled: boolean;
  aiForecastEnabled: boolean;
};

export type SystemControlRow = {
  id: string;
  module: string;
  control: string;
  env: string;
  expected: string;
  current: string;
  status: "ok" | "warn" | "missing" | "critical";
  severity: "low" | "medium" | "high" | "critical";
  owner: string;
};

// Dashboard Insights Types - TODO-004
export type ProbabilityInsight = {
  label: string;
  probability: string;
  impact: string;
  action: string;
};

export type CapacityPlanItem = {
  slot: string;
  demand: number;
  capacity: number;
  utilization: string;
  risk: string;
};

export type OverviewFact = {
  label: string;
  value: string;
};

export type DashboardInsights = {
  probabilityInsights: ProbabilityInsight[];
  capacityPlan: CapacityPlanItem[];
  overviewFacts: OverviewFact[];
};

export type SystemControlCheck = {
  checkedAt: string;
  total: number;
  ok: number;
  warn: number;
  missing: number;
  critical: number;
  coverage: number;
  rows: SystemControlRow[];
};

export type OrganizationConfig = {
  companyName: string;
  tagline: string;
  logo: string;
  foundedYear: number;
  employees: number;
  industry: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
};

export const adminService = {
  getStats(): Promise<SystemStats> {
    return apiRequest<SystemStats>("/admin/stats", { method: "GET" });
  },
  getInsights(): Promise<DashboardInsights> {
    return apiRequest<DashboardInsights>("/admin/insights", { method: "GET" });
  },
  getKpiTrends(): Promise<{ trends: Array<{ date: string; ordersNew: number; ordersProduction: number; ordersReady: number; ordersDelivered: number }> }> {
    return apiRequest<{ trends: Array<{ date: string; ordersNew: number; ordersProduction: number; ordersReady: number; ordersDelivered: number }> }>("/admin/kpi-trends", { method: "GET" });
  },
  getUsers(): Promise<AdminUser[]> {
    return this.listUsers();
  },
  listUsers(): Promise<AdminUser[]> {
    return apiRequest<AdminUser[]>("/admin/users", { method: "GET" });
  },
  createUser(payload: { username: string; password: string; display_name: string; email?: string; name?: string; role: string }): Promise<AdminUser> {
    return apiRequest<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateUser(userId: string, payload: Partial<{ display_name: string; email: string; name: string; role: string; is_active: boolean; password: string }>): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteUser(userId: string): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/admin/users/${userId}`, {
      method: "DELETE",
    });
  },
  resetUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: newPassword }),
    });
  },
  listLogs(page = 1, perPage = 200): Promise<AuditLog[]> {
    return apiRequest<AuditLog[]>(`/admin/logs?page=${page}&per_page=${perPage}`, { method: "GET" });
  },
  getAuditLogs(): Promise<AuditLog[]> {
    return this.listLogs();
  },
  toggleUser(userId: string): Promise<AdminUser> {
    return this.updateUser(userId, { is_active: false });
  },
  getStations(): Promise<StationDto[]> {
    return this.listStations();
  },
  listStations(): Promise<StationDto[]> {
    return apiRequest<StationDto[]>("/stations/", { method: "GET" });
  },
  async toggleStation(stationId: number): Promise<StationDto> {
    return apiRequest<StationDto>(`/stations/${stationId}/toggle`, { 
      method: "PATCH" 
    });
  },
  createStation(payload: { name: string; description?: string }): Promise<StationDto> {
    return apiRequest<StationDto>("/stations/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateStation(stationId: number, payload: Partial<Omit<StationDto, 'id' | 'active' | 'lastScanAt' | 'scanCountToday' | 'istasyonDurumu' | 'lastScan' | 'todayScans'>>): Promise<StationDto> {
    return apiRequest<StationDto>(`/stations/${stationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteStation(stationId: number): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/stations/${stationId}`, {
      method: "DELETE",
    });
  },
  scanStation(payload: { order_id: string; part_id?: string; station_id: number; scan_type?: string; timestamp?: string }): Promise<{ message: string; order_info?: Record<string, unknown> }> {
    return apiRequest<{ message: string; order_info?: Record<string, unknown> }>("/stations/scan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getMikroConfig(): Promise<MikroConfig> {
    return apiRequest<MikroConfig>("/admin/mikro/config", { method: "GET" });
  },
  saveMikroConfig(payload: Omit<MikroConfig, "configured">): Promise<MikroConfig> {
    return apiRequest<MikroConfig>("/admin/mikro/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  testMikroConfig(payload: Omit<MikroConfig, "configured">): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/admin/mikro/test", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listSqlTables(): Promise<SqlTableInfo[]> {
    return apiRequest<SqlTableInfo[]>("/sql/tables", { method: "GET" });
  },
  runSqlQuery(payload: { sql: string; limit: number }): Promise<SqlQueryResult> {
    return apiRequest<SqlQueryResult>("/sql/query", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getDeviceConfig(): Promise<DeviceConfig> {
    return apiRequest<DeviceConfig>("/ocr/device/config", { method: "GET" });
  },
  updateDeviceConfig(payload: { device_api_key?: string; device_name?: string }): Promise<DeviceConfig> {
    return apiRequest<DeviceConfig>("/ocr/device/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  ingestFromDevice(file: File, apiKey: string): Promise<{ success: boolean; jobId: string }> {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ success: boolean; jobId: string }>("/ocr/device/ingest", {
      method: "POST",
      skipAuth: true,
      headers: { "X-Device-Api-Key": apiKey },
      body: form,
    });
  },

  getTelegramConfig(): Promise<TelegramConfig> {
    return apiRequest<TelegramConfig>("/ocr/telegram/config", { method: "GET" });
  },
  updateTelegramConfig(payload: { bot_token?: string; webhook_secret?: string; allowed_chat_id?: string }): Promise<TelegramConfig> {
    return apiRequest<TelegramConfig>("/ocr/telegram/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  testTelegram(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/ocr/telegram/test", { method: "POST" });
  },

  getEmailConfig(): Promise<EmailConfig> {
    return apiRequest<EmailConfig>("/ocr/email/config", { method: "GET" });
  },
  updateEmailConfig(payload: { imap_host?: string; imap_port?: number; imap_user?: string; imap_pass?: string; imap_mailbox?: string }): Promise<EmailConfig> {
    return apiRequest<EmailConfig>("/ocr/email/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  testEmail(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/ocr/email/test", { method: "POST" });
  },
  fetchEmailNow(limit = 5): Promise<{ success: boolean; createdJobs: number; jobIds: string[]; message: string }> {
    return apiRequest<{ success: boolean; createdJobs: number; jobIds: string[]; message: string }>(`/ocr/email/fetch-now?limit=${limit}`, { method: "POST" });
  },

  getWhatsAppConfig(): Promise<WhatsAppConfig> {
    return apiRequest<WhatsAppConfig>("/whatsapp/config", { method: "GET" });
  },
  updateWhatsAppConfig(payload: { phone_number_id: string; business_account_id: string; access_token: string; api_version: string }): Promise<WhatsAppConfig> {
    return apiRequest<WhatsAppConfig>("/whatsapp/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  listWhatsAppTemplates(): Promise<Array<{ name: string; label: string; body: string; variables: string[] }>> {
    return apiRequest<Array<{ name: string; label: string; body: string; variables: string[] }>>("/whatsapp/templates", { method: "GET" });
  },
  sendWhatsAppMessage(payload: { to_phone: string; template_name?: string; message_text?: string; order_id?: string }): Promise<{ id: string; status: string }> {
    return apiRequest<{ id: string; status: string }>("/whatsapp/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getWhatsAppSummary(): Promise<{ configured: boolean; totalSent: number; todaySent: number; failed: number }> {
    return apiRequest<{ configured: boolean; totalSent: number; todaySent: number; failed: number }>("/whatsapp/summary", { method: "GET" });
  },
  listWhatsAppMessages(orderId?: string): Promise<Array<{ id: string; toPhone: string; message: string; status: string; sentBy: string; sentAt: string; error?: string }>> {
    const qs = orderId ? `?order_id=${orderId}` : "";
    return apiRequest<Array<{ id: string; toPhone: string; message: string; status: string; sentBy: string; sentAt: string; error?: string }>>(`/whatsapp/messages${qs}`, { method: "GET" });
  },

  getOCRConfig(): Promise<OCRConfig> {
    return apiRequest<OCRConfig>("/ocr/config", { method: "GET" });
  },
  updateOCRConfig(payload: Partial<{ engine: string; languages: string[]; preprocessing_enabled: boolean; confidence_threshold: number; api_key: string; azure_enabled: boolean; google_enabled: boolean; aws_enabled: boolean; tesseract_enabled: boolean }>): Promise<OCRConfig> {
    return apiRequest<OCRConfig>("/ocr/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  getAzureConfig(): Promise<{ configured: boolean; ocr_configured: boolean; blob_configured: boolean; ocr_endpoint?: string; ocr_region?: string; blob_container?: string }> {
    return apiRequest<{ configured: boolean; ocr_configured: boolean; blob_configured: boolean; ocr_endpoint?: string; ocr_region?: string; blob_container?: string }>("/azure/config", { method: "GET" });
  },
  updateAzureConfig(payload: unknown): Promise<unknown> {
    return apiRequest<unknown>("/azure/config", { method: "PUT", body: JSON.stringify(payload) });
  },
  testAzureOCR(): Promise<{ success: boolean; message: string; timestamp: string }> {
    return apiRequest<{ success: boolean; message: string; timestamp: string }>("/azure/test-ocr", { method: "POST" });
  },
  getAzureStats(): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>("/azure/stats", { method: "GET" });
  },

  getGoogleConfig(): Promise<{ configured: boolean; project_id?: string; location: string; enabled: boolean }> {
    return apiRequest<{ configured: boolean; project_id?: string; location: string; enabled: boolean }>("/ocr/google/config", { method: "GET" });
  },
  updateGoogleConfig(payload: { api_key: string; project_id?: string; location: string; enabled: boolean }): Promise<unknown> {
    return apiRequest<unknown>("/ocr/google/config", { method: "PUT", body: JSON.stringify(payload) });
  },
  testGoogle(): Promise<{ success: boolean; message: string; timestamp: string }> {
    return apiRequest<{ success: boolean; message: string; timestamp: string }>("/ocr/google/test", { method: "POST" });
  },
  getGoogleStats(): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>("/ocr/google/stats", { method: "GET" });
  },

  getAwsConfig(): Promise<{ configured: boolean; region: string; enabled: boolean }> {
    return apiRequest<{ configured: boolean; region: string; enabled: boolean }>("/ocr/aws/config", { method: "GET" });
  },
  updateAwsConfig(payload: { access_key_id: string; secret_access_key: string; region: string; enabled: boolean }): Promise<unknown> {
    return apiRequest<unknown>("/ocr/aws/config", { method: "PUT", body: JSON.stringify(payload) });
  },
  testAws(): Promise<{ success: boolean; message: string; timestamp: string }> {
    return apiRequest<{ success: boolean; message: string; timestamp: string }>("/ocr/aws/test", { method: "POST" });
  },
  getAwsStats(): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>("/ocr/aws/stats", { method: "GET" });
  },
  getOcrSummary(): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>("/ocr/summary", { method: "GET" });
  },

  // System Configuration
  getSystemConfig(): Promise<SystemConfig> {
    return apiRequest<SystemConfig>("/admin/config", { method: "GET" });
  },
  updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    return apiRequest<SystemConfig>("/admin/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },
  runSystemControlCheck(): Promise<SystemControlCheck> {
    return apiRequest<SystemControlCheck>("/admin/config/system-check", { method: "POST" });
  },

  // Organization Configuration
  getOrganizationConfig(): Promise<OrganizationConfig> {
    return apiRequest<OrganizationConfig>("/admin/organization", { method: "GET" });
  },
  updateOrganizationConfig(config: Partial<OrganizationConfig>): Promise<OrganizationConfig> {
    return apiRequest<OrganizationConfig>("/admin/organization", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  // User Activity & Session Management
  getUserActivities(params?: { user_id?: number; activity_type?: string; resource_type?: string; limit?: number; offset?: number }): Promise<Array<{
    id: string;
    userId: number;
    activityType: string;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    description?: string;
    status: string;
    ipAddress?: string;
    createdAt: string;
  }>> {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : "";
    return apiRequest(`/admin/activity/logs${queryString ? "?" + queryString : ""}`, { method: "GET" });
  },

  getUserSessions(params?: { user_id?: number; limit?: number; offset?: number }): Promise<Array<{
    id: string;
    userId: number;
    ipAddress?: string;
    deviceType?: string;
    loginAt: string;
    logoutAt?: string;
    lastActivityAt: string;
    isActive: boolean;
  }>> {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : "";
    return apiRequest(`/admin/activity/sessions${queryString ? "?" + queryString : ""}`, { method: "GET" });
  },

  terminateSession(sessionId: string): Promise<{ status: string }> {
    return apiRequest(`/admin/activity/sessions/${sessionId}/terminate`, { method: "POST" });
  },

  getAuditRecords(params?: { user_id?: number; entity_type?: string; operation?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }): Promise<Array<{
    id: string;
    userId: number;
    userName?: string;
    timestamp: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    operation: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    success: boolean;
    errorMessage?: string;
  }>> {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : "";
    return apiRequest(`/admin/audit/records${queryString ? "?" + queryString : ""}`, { method: "GET" });
  },

  getEntityAuditTrail(entityType: string, entityId: string): Promise<Array<unknown>> {
    return apiRequest(`/admin/audit/entity/${entityType}/${entityId}`, { method: "GET" });
  },

  getActivityStats(params?: { date_from?: string; date_to?: string }): Promise<{
    totalActivities: number;
    byActivityType: Record<string, number>;
    byResourceType: Record<string, number>;
  }> {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString() : "";
    return apiRequest(`/admin/activity/stats${queryString ? "?" + queryString : ""}`, { method: "GET" });
  },

  // Station Management
  testStationConnection(stationId: string): Promise<{
    stationId: string;
    status: string;
    lastContact: string;
    responseTimeMs: number;
  }> {
    return apiRequest(`/admin/stations/${stationId}/test`, { method: "POST" });
  },

  getStationDetail(stationId: string): Promise<{
    stationId: string;
    configuration: Record<string, unknown>;
    stats: { totalScans: number; todayScans: number };
    recentErrors: unknown[];
  }> {
    return apiRequest(`/admin/stations/${stationId}/detail`, { method: "GET" });
  },

  // Feature Flags
  getFeatureFlags(): Promise<{ features: Array<{ name: string; enabled: boolean; updatedAt: string | null }> }> {
    return apiRequest("/config/features", { method: "GET" });
  },
  updateFeatureFlag(name: string, enabled: boolean): Promise<{ featureName: string; enabled: boolean }> {
    return apiRequest(`/config/features/${name}?enabled=${enabled}`, { method: "PUT" });
  },

  // System Status
  getSystemStatus(): Promise<{ database: string; mikroConnection: string; uptimeSeconds: number; version: string }> {
    return apiRequest("/config/status", { method: "GET" });
  },

  // AI API Yapılandırması
  getAIConfig(): Promise<{
    provider: string;
    api_key_masked: string;
    api_key_set: boolean;
    model: string;
    max_tokens: number;
    temperature: number;
    enabled: boolean;
  }> {
    return apiRequest("/config/ai", { method: "GET" });
  },
  updateAIConfig(payload: {
    provider: string;
    api_key: string;
    model: string;
    max_tokens: number;
    temperature: number;
    enabled: boolean;
  }): Promise<{
    success: boolean;
    provider: string;
    api_key_masked: string;
    api_key_set: boolean;
    model: string;
    enabled: boolean;
  }> {
    return apiRequest("/config/ai", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  testAIConnection(): Promise<{ success: boolean; message: string; response_preview?: string }> {
    return apiRequest("/config/ai/test", { method: "POST" });
  },
};
