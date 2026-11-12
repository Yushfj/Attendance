import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { deleteAttendance, listAttendance } from "@/lib/db/local";
import { DEFAULT_TIMEZONE, formatExportLocal } from "@/lib/time";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const siteId = searchParams.get("siteId");
    const format = searchParams.get("format");

    const data = listAttendance({ from, to, employeeId, siteId });

    if (format === "csv") {
      const header = [
        "recorded_at_local",
        "timezone",
        "event_type",
        "employee_code",
        "full_name",
        "site",
        "confidence",
      ];
      const rows = data.map((row) => {
        const tz = row.sites?.timezone || DEFAULT_TIMEZONE;
        return [
          formatExportLocal(row.recorded_at, tz),
          tz,
          row.event_type,
          row.employees?.employee_code ?? "",
          row.employees?.full_name ?? "",
          row.sites?.name ?? "",
          row.confidence ?? "",
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",");
      });
      const csv = [header.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="attendance.csv"',
        },
      });
    }

    return NextResponse.json({ events: data });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    deleteAttendance(body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
