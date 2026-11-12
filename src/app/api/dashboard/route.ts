import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/db/local";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const stats = getDashboardStats();
    return NextResponse.json({
      ...stats,
      adminName: admin.full_name || stats.adminName,
    });
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
