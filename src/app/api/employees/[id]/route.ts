import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { updateEmployee } from "@/lib/db/local";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = (await request.json()) as {
      full_name?: string;
      department?: string | null;
      site_id?: string | null;
      active?: boolean;
      employee_code?: string;
    };

    const updates: Record<string, unknown> = {};
    if (typeof body.full_name === "string")
      updates.full_name = body.full_name.trim();
    if (typeof body.employee_code === "string")
      updates.employee_code = body.employee_code.trim();
    if ("department" in body)
      updates.department = body.department?.trim() || null;
    if ("site_id" in body) updates.site_id = body.site_id || null;
    if (typeof body.active === "boolean") updates.active = body.active;

    const employee = updateEmployee(id, updates);
    return NextResponse.json({ employee });
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
