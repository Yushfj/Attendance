import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { createEmployee, listEmployees, listSites } from "@/lib/db/local";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      employees: listEmployees(),
      sites: listSites().map((s) => ({ id: s.id, name: s.name })),
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

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      employee_code?: string;
      full_name?: string;
      department?: string | null;
      site_id?: string | null;
    };

    if (!body.employee_code?.trim() || !body.full_name?.trim()) {
      return NextResponse.json(
        { error: "employee_code and full_name are required" },
        { status: 400 },
      );
    }

    const employee = createEmployee({
      employee_code: body.employee_code.trim(),
      full_name: body.full_name.trim(),
      department: body.department?.trim() || null,
      site_id: body.site_id || null,
    });

    return NextResponse.json({ employee }, { status: 201 });
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
