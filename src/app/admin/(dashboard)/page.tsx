import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/db/local";

export default async function AdminDashboardPage() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");

  const stats = getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 ys-muted">
          Welcome, {admin.full_name}. Data is stored locally in{" "}
          <code className="rounded bg-[var(--bg-elevated)] px-1.5 text-[var(--primary-violet)]">
            data/attendance.json
          </code>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active employees" value={stats.employeeCount} />
        <StatCard label="Attendance events" value={stats.eventCount} />
        <StatCard label="Sites" value={stats.sites.length} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/employees" className="ys-btn ys-btn-primary">
          Manage employees
        </Link>
        <Link href="/admin/attendance" className="ys-btn ys-btn-secondary">
          View attendance
        </Link>
        {stats.sites.map((s) => (
          <Link
            key={s.id}
            href={`/kiosk?site=${s.id}`}
            className="ys-btn ys-btn-secondary"
          >
            Open kiosk: {s.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="ys-card p-5">
      <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums ys-gradient-text">
        {value}
      </p>
    </div>
  );
}
