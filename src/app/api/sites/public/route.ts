import { NextResponse } from "next/server";
import { getSite } from "@/lib/db/local";
import { DEFAULT_TIMEZONE } from "@/lib/time";

/** Public site info for kiosk clock display (timezone only). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const site = getSite(id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: site.id,
    name: site.name,
    timezone: site.timezone || DEFAULT_TIMEZONE,
  });
}
