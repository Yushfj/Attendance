import { NextResponse } from "next/server";
import { registerAdmin, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      full_name?: string;
    };
    if (!body.email?.trim() || !body.password || body.password.length < 6) {
      return NextResponse.json(
        { error: "Valid email and password (min 6 chars) required" },
        { status: 400 },
      );
    }

    const admin = await registerAdmin({
      email: body.email.trim(),
      password: body.password,
      full_name: body.full_name,
    });
    await setSessionCookie(admin.id);
    return NextResponse.json(
      {
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Register failed" },
      { status: 500 },
    );
  }
}
