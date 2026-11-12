import Link from "next/link";

const DEFAULT_SITE_ID = "22222222-2222-2222-2222-222222222222";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          YalSync Attendance
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Time in / time out with{" "}
          <span className="ys-gradient-text">face scan</span>
        </h1>
        <p className="mt-4 text-lg ys-muted">
          Use the kiosk at the entrance for clock-in and clock-out. Admins enroll
          employees and review attendance. For now, everything is saved locally
          on this computer.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/kiosk?site=${DEFAULT_SITE_ID}`}
          className="ys-btn ys-btn-primary h-11 px-5"
        >
          Open kiosk
        </Link>
        <Link href="/admin" className="ys-btn ys-btn-secondary h-11 px-5">
          Admin portal
        </Link>
      </div>
      <div className="ys-card p-5 text-sm ys-muted">
        <p className="font-medium text-white">Local storage</p>
        <p className="mt-2">
          Employees, face embeddings, and attendance logs are written to{" "}
          <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--primary-violet)]">
            data/attendance.json
          </code>
          . Only numeric face embeddings are stored — not video.
        </p>
      </div>
    </main>
  );
}
