"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type EmployeeRow = {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  site_id: string | null;
  active: boolean;
  face_embeddings: { id: string }[] | null;
};

type Site = { id: string; name: string };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [siteId, setSiteId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees");
      const json = (await res.json()) as {
        employees?: EmployeeRow[];
        sites?: Site[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load employees");
      setEmployees(json.employees ?? []);
      setSites(json.sites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_code: code,
          full_name: name,
          department: department || null,
          site_id: siteId || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Create failed");
      setCode("");
      setName("");
      setDepartment("");
      setSiteId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: EmployeeRow) {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm ys-muted">
          Add staff, then enroll a face for kiosk recognition.
        </p>
      </div>

      <form onSubmit={onCreate} className="ys-card grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-medium text-[var(--text-secondary)]">
          Add employee
        </h2>
        <input
          required
          placeholder="Employee code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="ys-input"
        />
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ys-input"
        />
        <input
          placeholder="Department (optional)"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="ys-input"
        />
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="ys-input"
        >
          <option value="">Default site (optional)</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="ys-btn ys-btn-primary sm:col-span-2"
        >
          {saving ? "Saving…" : "Create employee"}
        </button>
      </form>

      {error && <p className="ys-alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm ys-muted">Loading…</p>
      ) : (
        <div className="ys-table-wrap">
          <table className="ys-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Face</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const enrolled = (emp.face_embeddings?.length ?? 0) > 0;
                return (
                  <tr key={emp.id}>
                    <td className="font-mono text-xs text-[var(--text-tertiary)]">
                      {emp.employee_code}
                    </td>
                    <td>{emp.full_name}</td>
                    <td className="ys-muted">{emp.department || "—"}</td>
                    <td>
                      <span
                        className={`ys-badge ${
                          enrolled ? "ys-badge-success" : "ys-badge-warning"
                        }`}
                      >
                        {enrolled ? "Enrolled" : "Missing"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ys-badge ${
                          emp.active ? "ys-badge-info" : "ys-badge-muted"
                        }`}
                      >
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/employees/${emp.id}/enroll`}
                          className="ys-btn ys-btn-secondary h-8 px-2.5 text-xs"
                        >
                          Enroll face
                        </Link>
                        <button
                          type="button"
                          onClick={() => void toggleActive(emp)}
                          className="ys-btn ys-btn-secondary h-8 px-2.5 text-xs"
                        >
                          {emp.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center ys-muted">
                    No employees yet.
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
