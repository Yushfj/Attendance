import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { AttendanceEvent, Employee, EventType, Site } from "@/lib/types";

export type AdminUser = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: string;
};

export type FaceEmbeddingRow = {
  id: string;
  employee_id: string;
  embedding: number[];
  created_at: string;
};

export type LocalDb = {
  organizations: { id: string; name: string; created_at: string }[];
  sites: Site[];
  admins: AdminUser[];
  employees: Employee[];
  face_embeddings: FaceEmbeddingRow[];
  attendance_events: AttendanceEvent[];
};

export const DEFAULT_ORG_ID = "11111111-1111-1111-1111-111111111111";
export const DEFAULT_SITE_ID = "22222222-2222-2222-2222-222222222222";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "attendance.json");

function emptyDb(): LocalDb {
  const now = new Date().toISOString();
  return {
    organizations: [
      {
        id: DEFAULT_ORG_ID,
        name: "Default Organization",
        created_at: now,
      },
    ],
    sites: [
      {
        id: DEFAULT_SITE_ID,
        org_id: DEFAULT_ORG_ID,
        name: "Main Entrance",
        timezone: DEFAULT_TIMEZONE,
        created_at: now,
      },
    ],
    admins: [],
    employees: [],
    face_embeddings: [],
    attendance_events: [],
  };
}

function ensureDbFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2), "utf8");
  }
}

export function readDb(): LocalDb {
  ensureDbFile();
  const raw = readFileSync(DB_PATH, "utf8");
  const db = JSON.parse(raw) as LocalDb;
  // Migrate older local DBs that predate site.timezone
  let dirty = false;
  for (const site of db.sites) {
    if (!site.timezone) {
      site.timezone = DEFAULT_TIMEZONE;
      dirty = true;
    }
  }
  if (dirty) writeDb(db);
  return db;
}

export function writeDb(db: LocalDb) {
  ensureDbFile();
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  renameSync(tmp, DB_PATH);
}

export function withDb<T>(fn: (db: LocalDb) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function newId() {
  return randomUUID();
}

export function listEmployees() {
  const db = readDb();
  return db.employees
    .map((e) => ({
      ...e,
      face_embeddings: db.face_embeddings
        .filter((f) => f.employee_id === e.id)
        .map((f) => ({ id: f.id })),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function createEmployee(input: {
  employee_code: string;
  full_name: string;
  department?: string | null;
  site_id?: string | null;
}) {
  return withDb((db) => {
    const exists = db.employees.some(
      (e) => e.employee_code === input.employee_code,
    );
    if (exists) throw new Error("Employee code already exists");

    const employee: Employee = {
      id: newId(),
      org_id: DEFAULT_ORG_ID,
      site_id: input.site_id || DEFAULT_SITE_ID,
      employee_code: input.employee_code,
      full_name: input.full_name,
      department: input.department ?? null,
      active: true,
      created_at: new Date().toISOString(),
    };
    db.employees.push(employee);
    return employee;
  });
}

export function updateEmployee(
  id: string,
  updates: Partial<
    Pick<Employee, "full_name" | "employee_code" | "department" | "site_id" | "active">
  >,
) {
  return withDb((db) => {
    const emp = db.employees.find((e) => e.id === id);
    if (!emp) throw new Error("Employee not found");
    Object.assign(emp, updates);
    return emp;
  });
}

export function enrollFace(employeeId: string, embedding: number[]) {
  return withDb((db) => {
    const emp = db.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error("Employee not found");
    db.face_embeddings = db.face_embeddings.filter(
      (f) => f.employee_id !== employeeId,
    );
    const row: FaceEmbeddingRow = {
      id: newId(),
      employee_id: employeeId,
      embedding,
      created_at: new Date().toISOString(),
    };
    db.face_embeddings.push(row);
    return row;
  });
}

export function listSites() {
  return readDb().sites.map((s) => ({
    ...s,
    timezone: s.timezone || DEFAULT_TIMEZONE,
  }));
}

export function getSite(id: string) {
  const site = readDb().sites.find((s) => s.id === id) ?? null;
  if (!site) return null;
  return { ...site, timezone: site.timezone || DEFAULT_TIMEZONE };
}

export function getMatchCandidates(orgId: string) {
  const db = readDb();
  const activeIds = new Set(
    db.employees
      .filter((e) => e.org_id === orgId && e.active)
      .map((e) => e.id),
  );
  return db.face_embeddings
    .filter((f) => activeIds.has(f.employee_id))
    .map((f) => ({
      employeeId: f.employee_id,
      embedding: f.embedding,
    }));
}

export function getEmployee(id: string) {
  return readDb().employees.find((e) => e.id === id) ?? null;
}

export function getLastEvent(employeeId: string) {
  const events = readDb()
    .attendance_events.filter((e) => e.employee_id === employeeId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  return events[0] ?? null;
}

export function getRecentEvent(employeeId: string, sinceIso: string) {
  const events = readDb()
    .attendance_events.filter(
      (e) => e.employee_id === employeeId && e.recorded_at >= sinceIso,
    )
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  return events[0] ?? null;
}

export function insertAttendanceEvent(input: {
  employee_id: string;
  site_id: string;
  kiosk_device_id?: string | null;
  event_type: EventType;
  confidence: number;
}) {
  return withDb((db) => {
    const event: AttendanceEvent = {
      id: newId(),
      employee_id: input.employee_id,
      site_id: input.site_id,
      kiosk_device_id: input.kiosk_device_id ?? null,
      event_type: input.event_type,
      confidence: input.confidence,
      recorded_at: new Date().toISOString(),
    };
    db.attendance_events.push(event);
    return event;
  });
}

export function listAttendance(filters: {
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
  siteId?: string | null;
}) {
  const db = readDb();
  let events = [...db.attendance_events];
  if (filters.from) events = events.filter((e) => e.recorded_at >= filters.from!);
  if (filters.to) events = events.filter((e) => e.recorded_at <= filters.to!);
  if (filters.employeeId)
    events = events.filter((e) => e.employee_id === filters.employeeId);
  if (filters.siteId) events = events.filter((e) => e.site_id === filters.siteId);

  return events
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, 1000)
    .map((e) => {
      const emp = db.employees.find((x) => x.id === e.employee_id);
      const site = db.sites.find((x) => x.id === e.site_id);
      return {
        ...e,
        employees: emp
          ? { full_name: emp.full_name, employee_code: emp.employee_code }
          : null,
        sites: site
          ? {
              name: site.name,
              timezone: site.timezone || DEFAULT_TIMEZONE,
            }
          : null,
      };
    });
}

export function deleteAttendance(id: string) {
  return withDb((db) => {
    const before = db.attendance_events.length;
    db.attendance_events = db.attendance_events.filter((e) => e.id !== id);
    return before !== db.attendance_events.length;
  });
}

export function getDashboardStats() {
  const db = readDb();
  return {
    employeeCount: db.employees.filter((e) => e.active).length,
    eventCount: db.attendance_events.length,
    sites: db.sites.map((s) => ({ id: s.id, name: s.name })),
    adminName: db.admins[0]?.full_name ?? null,
  };
}

export function findAdminByEmail(email: string) {
  return (
    readDb().admins.find(
      (a) => a.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export function createAdmin(input: {
  email: string;
  password_hash: string;
  full_name: string;
}) {
  return withDb((db) => {
    if (
      db.admins.some((a) => a.email.toLowerCase() === input.email.toLowerCase())
    ) {
      throw new Error("Admin email already exists");
    }
    const admin: AdminUser = {
      id: newId(),
      email: input.email.toLowerCase(),
      password_hash: input.password_hash,
      full_name: input.full_name,
      created_at: new Date().toISOString(),
    };
    db.admins.push(admin);
    return admin;
  });
}

export function getAdmin(id: string) {
  return readDb().admins.find((a) => a.id === id) ?? null;
}

export function getDbPath() {
  return DB_PATH;
}
