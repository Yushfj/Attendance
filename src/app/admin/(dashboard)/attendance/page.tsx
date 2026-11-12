"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DEFAULT_TIMEZONE, formatDateTimeLocal } from "@/lib/time";

type EventRow = {
  id: string;
  event_type: "in" | "out";
  confidence: number | null;
  recorded_at: string;
  employee_id: string;
  site_id: string;
  employees: { full_name: string; employee_code: string } | null;
  sites: { name: string; timezone?: string } | null;
};

type EmployeeOpt = { id: string; full_name: string };
type SiteOpt = { id: string; name: string };

export default function AttendancePage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    const [empRes, siteRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/sites"),
    ]);
    const empJson = (await empRes.json()) as {
      employees?: { id: string; full_name: string; active: boolean }[];
    };
    const siteJson = (await siteRes.json()) as {
      sites?: SiteOpt[];
    };
    setEmployees(
      (empJson.employees ?? [])
        .filter((e) => e.active)
        .map((e) => ({ id: e.id, full_name: e.full_name })),
    );
    setSites(siteJson.sites ?? []);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      if (employeeId) params.set("employeeId", employeeId);
      if (siteId) params.set("siteId", siteId);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = (await res.json()) as { events?: EventRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setEvents(json.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to, employeeId, siteId]);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    void loadEvents();
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }
    if (employeeId) params.set("employeeId", employeeId);
    if (siteId) params.set("siteId", siteId);
    window.location.href = `/api/attendance?${params.toString()}`;
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this attendance event?")) return;
    const res = await fetch("/api/attendance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) void loadEvents();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-1 text-sm ys-muted">
            Filter clock events and export CSV. Times use site local timezone.
          </p>
        </div>
        <button type="button" onClick={exportCsv} className="ys-btn ys-btn-secondary">
          Export CSV
        </button>
      </div>

      <form onSubmit={onFilter} className="ys-card grid gap-3 p-4 sm:grid-cols-5">
        <label className="text-sm">
          <span className="ys-label">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ys-input"
          />
        </label>
        <label className="text-sm">
          <span className="ys-label">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ys-input"
          />
        </label>
        <label className="text-sm">
          <span className="ys-label">Employee</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="ys-input"
          >
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="ys-label">Site</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="ys-input"
          >
            <option value="">All</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="ys-btn ys-btn-primary w-full">
            Apply
          </button>
        </div>
      </form>

      {error && <p className="ys-alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm ys-muted">Loading…</p>
      ) : (
        <div className="ys-table-wrap">
          <table className="ys-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Employee</th>
                <th>Event</th>
                <th>Site</th>
                <th>Distance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTimeLocal(
                      ev.recorded_at,
                      ev.sites?.timezone || DEFAULT_TIMEZONE,
                    )}
                  </td>
                  <td>
                    <div>{ev.employees?.full_name ?? "—"}</div>
                    <div className="font-mono text-xs text-[var(--text-tertiary)]">
                      {ev.employees?.employee_code}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`ys-badge uppercase ${
                        ev.event_type === "in"
                          ? "ys-badge-success"
                          : "ys-badge-info"
                      }`}
                    >
                      {ev.event_type}
                    </span>
                  </td>
                  <td>{ev.sites?.name ?? "—"}</td>
                  <td className="tabular-nums text-[var(--text-tertiary)]">
                    {ev.confidence != null ? ev.confidence.toFixed(3) : "—"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => void deleteEvent(ev.id)}
                      className="ys-btn ys-btn-danger text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center ys-muted">
                    No events for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
