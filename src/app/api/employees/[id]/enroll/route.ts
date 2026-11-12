import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { averageEmbeddings, parseEmbedding } from "@/lib/face/match";
import { enrollFace } from "@/lib/db/local";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id: employeeId } = await params;
    const body = (await request.json()) as { embeddings?: unknown };

    if (!Array.isArray(body.embeddings) || body.embeddings.length === 0) {
      return NextResponse.json(
        { error: "embeddings must be a non-empty array of descriptor arrays" },
        { status: 400 },
      );
    }

    const parsed: number[][] = [];
    for (const raw of body.embeddings) {
      const emb = parseEmbedding(raw);
      if (!emb || emb.length < 64) {
        return NextResponse.json(
          { error: "Each embedding must be a numeric descriptor array" },
          { status: 400 },
        );
      }
      parsed.push(emb);
    }

    const averaged = averageEmbeddings(parsed);
    const row = enrollFace(employeeId, averaged);

    return NextResponse.json({
      embedding: { id: row.id, created_at: row.created_at },
      samplesUsed: parsed.length,
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
