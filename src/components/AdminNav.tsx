"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/attendance", label: "Attendance" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="ys-header sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold tracking-tight">
            Yal<span className="ys-gradient-text">Sync</span>{" "}
            <span className="text-[var(--text-secondary)] font-normal">
              Attendance
            </span>
          </Link>
          <nav className="flex gap-1">
            {links.map((l) => {
              const active =
                l.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`ys-nav-link ${active ? "ys-nav-link-active" : ""}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button type="button" onClick={() => void signOut()} className="ys-btn ys-btn-secondary">
          Sign out
        </button>
      </div>
    </header>
  );
}
