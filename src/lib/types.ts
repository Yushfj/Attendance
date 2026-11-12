export type EventType = "in" | "out";

export type Organization = {
  id: string;
  name: string;
  created_at: string;
};

export type Site = {
  id: string;
  org_id: string;
  name: string;
  /** IANA timezone for this location, e.g. Asia/Manila */
  timezone: string;
  created_at: string;
};

export type Profile = {
  id: string;
  org_id: string;
  full_name: string | null;
  role: "admin";
  created_at: string;
};

export type Employee = {
  id: string;
  org_id: string;
  site_id: string | null;
  employee_code: string;
  full_name: string;
  department: string | null;
  active: boolean;
  created_at: string;
};

export type FaceEmbedding = {
  id: string;
  employee_id: string;
  embedding: number[];
  created_at: string;
};

export type AttendanceEvent = {
  id: string;
  employee_id: string;
  site_id: string;
  kiosk_device_id: string | null;
  event_type: EventType;
  confidence: number | null;
  recorded_at: string;
};

export type AttendanceEventWithRelations = AttendanceEvent & {
  employees: Pick<Employee, "full_name" | "employee_code"> | null;
  sites: Pick<Site, "name"> | null;
};

export type ClockResult = {
  ok: true;
  employee: { id: string; full_name: string; employee_code: string };
  event_type: EventType;
  recorded_at: string;
  /** Wall-clock time at the site location */
  recorded_at_local: string;
  timezone: string;
  confidence: number;
  deduped?: boolean;
};

export type ClockError = {
  ok: false;
  error: string;
  code:
    | "unauthorized"
    | "invalid_payload"
    | "unknown_face"
    | "inactive"
    | "site_not_found"
    | "server_error";
};
