import { NextResponse } from "next/server";
import { loginAdmin, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    if (!body.email?.trim() || !body.password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const admin = await loginAdmin(body.email.trim(), body.password);
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    await setSessionCookie(admin.id);
    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, full_name: admin.full_name },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login failed" },
      { status: 500 },
    );
  }
}
