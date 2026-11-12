import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth/session";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  return NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
    },
  });
}
