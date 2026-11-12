import { NextResponse } from "next/server";
import { findBestMatch, parseEmbedding } from "@/lib/face/match";
import {
  DEFAULT_ORG_ID,
  getEmployee,
  getLastEvent,
  getMatchCandidates,
  getRecentEvent,
  getSite,
  insertAttendanceEvent,
} from "@/lib/db/local";
import { formatDateTimeLocal, resolveTimezone } from "@/lib/time";
import type { ClockError, ClockResult, EventType } from "@/lib/types";

export const runtime = "nodejs";

function err(status: number, code: ClockError["code"], error: string) {
  const body: ClockError = { ok: false, code, error };
  return NextResponse.json(body, { status });
}

function clockPayload(
  employee: { id: string; full_name: string; employee_code: string },
  event_type: EventType,
  recorded_at: string,
  confidence: number,
  timezone: string,
  deduped?: boolean,
): ClockResult {
  const tz = resolveTimezone(timezone);
  return {
    ok: true,
    employee: {
      id: employee.id,
      full_name: employee.full_name,
      employee_code: employee.employee_code,
    },
    event_type,
    recorded_at,
    recorded_at_local: formatDateTimeLocal(recorded_at, tz),
    timezone: tz,
    confidence,
    deduped,
  };
}

export async function POST(request: Request) {
  try {
    const secret = process.env.KIOSK_SECRET || "dev-kiosk-secret-change-me";
    const headerSecret = request.headers.get("x-kiosk-secret");
    if (!headerSecret || headerSecret !== secret) {
      return err(401, "unauthorized", "Invalid kiosk secret");
    }

    const body = (await request.json()) as {
      embedding?: unknown;
      siteId?: string;
      kioskDeviceId?: string | null;
    };

    const embedding = parseEmbedding(body.embedding);
    const siteId = body.siteId;
    if (!embedding || embedding.length < 64 || !siteId) {
      return err(400, "invalid_payload", "Expected embedding array and siteId");
    }

    const threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? "0.55");
    const dedupeSeconds = Number(process.env.CLOCK_DEDUPE_SECONDS ?? "45");

    const site = getSite(siteId);
    if (!site) return err(404, "site_not_found", "Site not found");

    const candidates = getMatchCandidates(site.org_id || DEFAULT_ORG_ID);
    const match = findBestMatch(embedding, candidates, threshold);
    if (!match) return err(404, "unknown_face", "Face not recognized");

    const employee = getEmployee(match.employeeId);
    if (!employee) return err(404, "unknown_face", "Face not recognized");
    if (!employee.active) return err(403, "inactive", "Employee is inactive");

    const since = new Date(Date.now() - dedupeSeconds * 1000).toISOString();
    const recent = getRecentEvent(employee.id, since);
    if (recent) {
      return NextResponse.json(
        clockPayload(
          employee,
          recent.event_type,
          recent.recorded_at,
          match.distance,
          site.timezone,
          true,
        ),
      );
    }

    const lastEvent = getLastEvent(employee.id);
    const eventType: EventType =
      !lastEvent || lastEvent.event_type === "out" ? "in" : "out";

    const inserted = insertAttendanceEvent({
      employee_id: employee.id,
      site_id: siteId,
      kiosk_device_id: body.kioskDeviceId ?? null,
      event_type: eventType,
      confidence: match.distance,
    });

    return NextResponse.json(
      clockPayload(
        employee,
        eventType,
        inserted.recorded_at,
        match.distance,
        site.timezone,
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return err(500, "server_error", message);
  }
}
