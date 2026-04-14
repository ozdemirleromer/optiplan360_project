export interface IntegrationReadinessField {
  key: string;
  label: string;
  owner: string;
  ready: boolean;
  value: string;
  note: string;
  blockingCode?: string | null;
  blockingCount?: number | null;
}

export interface IntegrationReadinessProfile {
  scope: string;
  scopeLabel: string;
  sourceSystem?: string | null;
  readyFields: number;
  totalFields: number;
  blockingCodes: string[];
  fields: IntegrationReadinessField[];
  masterDataStatus?: string | null;
  masterDataSummary?: string | null;
  entityMapStatus?: string | null;
  entityMapExternalId?: string | null;
  accountMikroCariKod?: string | null;
  outboxStatus?: string | null;
  outboxRetryCount?: number | null;
  outboxMaxRetries?: number | null;
  lastSyncedAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}
