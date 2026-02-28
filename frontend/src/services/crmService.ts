import { apiRequest } from "./apiClient";

// ── Enums ──
export enum OpportunityStage {
  LEAD = "LEAD",
  QUALIFIED = "QUALIFIED",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  CLOSED_WON = "CLOSED_WON",
  CLOSED_LOST = "CLOSED_LOST",
}

export enum QuoteStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  REVISED = "REVISED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum ActivityType {
  CALL = "CALL",
  MEETING = "MEETING",
  EMAIL = "EMAIL",
  NOTE = "NOTE",
  TASK = "TASK",
}

// ── Types ──
// NOT: apiClient.ts transformKeys() tüm API yanıtlarını camelCase'e çevirir.
// Bu yüzden response interface'leri camelCase olmalıdır.
export interface CRMAccount {
  id: string;
  companyName: string;
  taxId?: string;
  taxOffice?: string;
  accountType?: string;
  industry?: string;
  website?: string;
  city?: string;
  district?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  balance?: number;
  paymentTermDays?: number;
  mikroCariKod?: string;
  plakaBirimFiyat?: number;
  bantMetreFiyat?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  contacts?: CRMContact[];
}

export interface CRMContact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMOpportunity {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  stage: OpportunityStage;
  amount?: number;
  probability?: number;
  expectedCloseDate?: string;
  orderId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  account?: CRMAccount;
}

export interface CRMQuote {
  id: string;
  accountId: string;
  opportunityId?: string;
  quoteNumber: string;
  revision: number;
  title: string;
  description?: string;
  status: QuoteStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  total: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lines?: CRMQuoteLine[];
}

export interface CRMQuoteLine {
  id: string;
  quoteId: string;
  lineNumber: number;
  productCode?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  lineTotal: number;
  mikroStokKod?: string;
  notes?: string;
}

export interface CRMTask {
  id: string;
  accountId?: string;
  opportunityId?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMActivity {
  id: string;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  activityType: ActivityType;
  subject: string;
  body?: string;
  activityDate: string;
  durationMinutes?: number;
  createdBy?: string;
  createdAt: string;
}

export interface CRMNote {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  createdBy?: string;
  createdAt: string;
}

export interface CRMTicketMessage {
  id: string;
  ticketId: string;
  senderId: number;
  senderName?: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CRMTicket {
  id: string;
  accountId: string;
  accountName?: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedToId?: number;
  createdById?: number;
  createdAt: string;
  updatedAt: string;
  messages?: CRMTicketMessage[];
}

export interface CRMStats {
  totalAccounts?: number;
  activeAccounts?: number;
  totalOpportunities?: number;
  openOpportunities?: number;
  pipelineValue?: number;
  avgCloseProbability?: number;
  stageDistribution?: Record<string, number>;
  wonCount?: number;
  totalQuotes?: number;
  pendingTasks?: number;
  pipeline?: Record<string, { count: number; value: number }>;
}

type ListResponse<T> = { data: T[]; total?: number } | T[];

function normalizeList<T>(payload: ListResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.data || [];
}

// ── Create/Update Types ──
export interface AccountInput {
  company_name: string;
  tax_id?: string;
  tax_office?: string;
  account_type?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
  balance?: number;
  payment_term_days?: number;
  mikro_cari_kod?: string;
  plaka_birim_fiyat?: number;
  bant_metre_fiyat?: number;
  notes?: string;
}

export interface ContactInput {
  account_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface OpportunityInput {
  account_id: string;
  title: string;
  description?: string;
  stage?: OpportunityStage;
  amount?: number;
  probability?: number;
  expected_close_date?: string;
  notes?: string;
}

export interface StageTransitionInput {
  stage: OpportunityStage;
  notes?: string;
}

export interface QuoteInput {
  account_id: string;
  opportunity_id?: string;
  title: string;
  description?: string;
  tax_rate: number;
  discount_rate?: number;
  valid_until?: string;
  notes?: string;
  lines: QuoteLineInput[];
}

export interface QuoteLineInput {
  product_code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_rate?: number;
  mikro_stok_kod?: string;
  notes?: string;
}

export interface TaskInput {
  account_id?: string;
  opportunity_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  due_date?: string;
  assigned_to?: string;
}

export interface ActivityInput {
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  activity_type: ActivityType;
  subject: string;
  body?: string;
  activity_date: string;
  duration_minutes?: number;
}

export interface NoteInput {
  entity_type: string;
  entity_id: string;
  content: string;
}

// ── Service ──
export const crmService = {
  // Accounts
  async listAccounts(params?: { search?: string; is_active?: boolean }): Promise<CRMAccount[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMAccount>>(`/crm/accounts${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async getAccount(id: string): Promise<CRMAccount> {
    return apiRequest<CRMAccount>(`/crm/accounts/${id}`, { method: "GET" });
  },

  async createAccount(payload: AccountInput): Promise<CRMAccount> {
    return apiRequest<CRMAccount>("/crm/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateAccount(id: string, payload: Partial<AccountInput>): Promise<CRMAccount> {
    return apiRequest<CRMAccount>(`/crm/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteAccount(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/crm/accounts/${id}`, { method: "DELETE" });
  },

  // Contacts
  async listContacts(params?: { account_id?: string }): Promise<CRMContact[]> {
    const query = new URLSearchParams();
    if (params?.account_id) query.set("account_id", params.account_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMContact>>(`/crm/contacts${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async createContact(payload: ContactInput): Promise<CRMContact> {
    return apiRequest<CRMContact>("/crm/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateContact(id: string, payload: Partial<ContactInput>): Promise<CRMContact> {
    return apiRequest<CRMContact>(`/crm/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // Opportunities
  async listOpportunities(params?: { stage?: OpportunityStage; account_id?: string }): Promise<CRMOpportunity[]> {
    const query = new URLSearchParams();
    if (params?.stage) query.set("stage", params.stage);
    if (params?.account_id) query.set("account_id", params.account_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMOpportunity>>(`/crm/opportunities${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async getOpportunity(id: string): Promise<CRMOpportunity> {
    return apiRequest<CRMOpportunity>(`/crm/opportunities/${id}`, { method: "GET" });
  },

  async createOpportunity(payload: OpportunityInput): Promise<CRMOpportunity> {
    return apiRequest<CRMOpportunity>("/crm/opportunities", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateOpportunity(id: string, payload: Partial<OpportunityInput>): Promise<CRMOpportunity> {
    return apiRequest<CRMOpportunity>(`/crm/opportunities/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async transitionStage(id: string, payload: StageTransitionInput): Promise<CRMOpportunity> {
    return apiRequest<CRMOpportunity>(`/crm/opportunities/${id}/transition`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async convertToOrder(id: string): Promise<{ order_id: string; opportunity: CRMOpportunity }> {
    return apiRequest<{ order_id: string; opportunity: CRMOpportunity }>(`/crm/opportunities/${id}/convert`, {
      method: "POST",
    });
  },

  // Quotes
  async listQuotes(params?: { account_id?: string; opportunity_id?: string }): Promise<CRMQuote[]> {
    const query = new URLSearchParams();
    if (params?.account_id) query.set("account_id", params.account_id);
    if (params?.opportunity_id) query.set("opportunity_id", params.opportunity_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMQuote>>(`/crm/quotes${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async getQuote(id: string): Promise<CRMQuote> {
    return apiRequest<CRMQuote>(`/crm/quotes/${id}`, { method: "GET" });
  },

  async createQuote(payload: QuoteInput): Promise<CRMQuote> {
    return apiRequest<CRMQuote>("/crm/quotes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async reviseQuote(id: string): Promise<CRMQuote> {
    return apiRequest<CRMQuote>(`/crm/quotes/${id}/revise`, {
      method: "POST",
    });
  },

  // Tasks
  async listTasks(params?: { account_id?: string; opportunity_id?: string; status?: TaskStatus }): Promise<CRMTask[]> {
    const query = new URLSearchParams();
    if (params?.account_id) query.set("account_id", params.account_id);
    if (params?.opportunity_id) query.set("opportunity_id", params.opportunity_id);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMTask>>(`/crm/tasks${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async createTask(payload: TaskInput): Promise<CRMTask> {
    return apiRequest<CRMTask>("/crm/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateTask(id: string, payload: Partial<TaskInput>): Promise<CRMTask> {
    return apiRequest<CRMTask>(`/crm/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // Activities
  async listActivities(params?: { account_id?: string; contact_id?: string; opportunity_id?: string }): Promise<CRMActivity[]> {
    const query = new URLSearchParams();
    if (params?.account_id) query.set("account_id", params.account_id);
    if (params?.contact_id) query.set("contact_id", params.contact_id);
    if (params?.opportunity_id) query.set("opportunity_id", params.opportunity_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMActivity>>(`/crm/activities${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async createActivity(payload: ActivityInput): Promise<CRMActivity> {
    return apiRequest<CRMActivity>("/crm/activities", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Notes
  async listNotes(params: { entity_type: string; entity_id: string }): Promise<CRMNote[]> {
    const query = new URLSearchParams();
    query.set("entity_type", params.entity_type);
    query.set("entity_id", params.entity_id);
    const payload = await apiRequest<ListResponse<CRMNote>>(`/crm/notes?${query.toString()}`, { method: "GET" });
    return normalizeList(payload);
  },

  async createNote(payload: NoteInput): Promise<CRMNote> {
    return apiRequest<CRMNote>("/crm/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Stats
  async getStats(): Promise<CRMStats> {
    return apiRequest<CRMStats>("/crm/stats", { method: "GET" });
  },

  // Tickets (Support)
  async listTickets(params?: { status?: string; account_id?: string }): Promise<CRMTicket[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.account_id) query.set("account_id", params.account_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<CRMTicket>>(`/crm/tickets${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async getTicket(id: string): Promise<CRMTicket> {
    return apiRequest<CRMTicket>(`/crm/tickets/${id}`, { method: "GET" });
  },

  async replyTicket(id: string, message: string, isInternal: boolean = false): Promise<CRMTicketMessage> {
    return apiRequest<CRMTicketMessage>(`/crm/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message, is_internal: isInternal }),
    });
  },

  async updateTicketStatus(id: string, status: string, assignedToId?: number): Promise<CRMTicket> {
    return apiRequest<CRMTicket>(`/crm/tickets/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, assigned_to_id: assignedToId }),
    });
  },
};

