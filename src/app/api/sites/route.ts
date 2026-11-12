import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { listSites } from "@/lib/db/local";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      sites: listSites().map((s) => ({
        id: s.id,
        name: s.name,
        timezone: s.timezone,
      })),
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
