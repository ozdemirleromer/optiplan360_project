export type JobState =
  | "NEW"
  | "PREPARED"
  | "OPTI_IMPORTED"
  | "OPTI_RUNNING"
  | "OPTI_DONE"
  | "XML_READY"
  | "DELIVERED"
  | "DONE"
  | "HOLD"
  | "FAILED";

export interface JobSummary {
  id: string;
  order_id: string;
  state: JobState;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  opti_mode: "A" | "B" | "C";
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  job_id: string;
  event_type: string;
  message: string;
  details_json: string | null;
  created_at: string;
}

export interface JobDetailResponse {
  job: JobSummary;
  audit: AuditEvent[];
}
