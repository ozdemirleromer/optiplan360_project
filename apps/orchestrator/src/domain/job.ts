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

export type OptiMode = "A" | "B" | "C";

export type PartType = "GOVDE" | "ARKALIK";

export interface PlateSize {
  width_mm: number;
  height_mm: number;
}

export interface JobPartInput {
  id: string;
  part_type: PartType;
  material_code: string;
  length_cm: number;
  width_cm: number;
  quantity: number;
  grain: 0 | 1 | 2 | 3;
  color: string;
  thickness_mm: number;
  edge_up?: string | null;
  edge_lo?: string | null;
  edge_sx?: string | null;
  edge_dx?: string | null;
  iidesc?: string;
  desc1?: string;
  delik_kodu?: string | null;
}

export interface JobPayload {
  order_id: string;
  customer_phone: string;
  customer_snapshot_name?: string;
  plate_size?: PlateSize;
  opti_mode?: OptiMode;
  parts: JobPartInput[];
}

export interface JobRecord {
  id: string;
  order_id: string;
  payload_json: string;
  payload_hash: string;
  state: JobState;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  opti_mode: OptiMode;
  next_run_at: string;
  claim_token: string | null;
  manual_trigger_approved: number;
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

export interface CustomerRecord {
  id: string;
  name: string;
  phone_normalized: string;
  created_at: string;
}
