"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WebcamCapture } from "@/components/WebcamCapture";
import { detectFaces, loadFaceModels } from "@/lib/face/client";
import { LivenessTracker } from "@/lib/face/liveness";
import {
  DEFAULT_TIMEZONE,
  formatDateLocal,
  formatTimeLocal,
} from "@/lib/time";
import type { ClockError, ClockResult } from "@/lib/types";

type Phase = "loading" | "idle" | "scanning" | "success" | "error";

const STABLE_FRAMES = 3;
const RESET_MS = 4000;
const SCAN_INTERVAL_MS = 200;

function KioskInner() {
  const searchParams = useSearchParams();
  const siteId =
    searchParams.get("site") || "22222222-2222-2222-2222-222222222222";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanningRef = useRef(false);
  const detectingRef = useRef(false);
  const stableCountRef = useRef(0);
  const lastDescriptorRef = useRef<number[] | null>(null);
  const livenessRef = useRef(new LivenessTracker());

  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("Loading face models…");
  const [result, setResult] = useState<ClockResult | null>(null);
  const [kioskSecret, setKioskSecret] = useState("");
  const [secretReady, setSecretReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [siteName, setSiteName] = useState("Main Entrance");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    const stored = sessionStorage.getItem("kiosk_secret") || "";
    if (stored) {
      setKioskSecret(stored);
      setSecretReady(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/sites/public?id=${siteId}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          name?: string;
          timezone?: string;
        };
        if (json.name) setSiteName(json.name);
        if (json.timezone) setTimezone(json.timezone);
      } catch {
        // keep defaults
      }
    })();
  }, [siteId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadFaceModels();
        setPhase("idle");
        setMessage("Look at the camera — blink once (photos not allowed)");
      } catch {
        setPhase("error");
        setMessage(
          "Failed to load face models. Place weights in /public/models.",
        );
      }
    })();
  }, []);

  const onVideoReady = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
  }, []);

  const resetToIdle = useCallback(() => {
    setResult(null);
    setPhase("idle");
    setMessage("Look at the camera — blink once (photos not allowed)");
    stableCountRef.current = 0;
    lastDescriptorRef.current = null;
    scanningRef.current = false;
    livenessRef.current.reset();
  }, []);

  const clockIn = useCallback(
    async (embedding: number[]) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setPhase("scanning");
      setMessage("Recognizing…");

      try {
        const res = await fetch("/api/attendance/clock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiosk-secret": kioskSecret,
          },
          body: JSON.stringify({ embedding, siteId }),
        });
        const json = (await res.json()) as ClockResult | ClockError;

        if (!json.ok) {
          setPhase("error");
          setMessage(json.error);
          setTimeout(resetToIdle, RESET_MS);
          return;
        }

        setResult(json);
        setPhase("success");
        setMessage(
          json.deduped
            ? `Already recorded ${json.event_type.toUpperCase()}`
            : `Time ${json.event_type.toUpperCase()}`,
        );
        setTimeout(resetToIdle, RESET_MS);
      } catch {
        setPhase("error");
        setMessage("Network error — try again");
        setTimeout(resetToIdle, RESET_MS);
      }
    },
    [kioskSecret, resetToIdle, siteId],
  );

  useEffect(() => {
    if (!secretReady || phase === "loading") return;
    if (phase === "success" || phase === "error") return;

    const id = window.setInterval(() => {
      void (async () => {
        const video = videoRef.current;
        if (!video || scanningRef.current || detectingRef.current || video.readyState < 2)
          return;

        detectingRef.current = true;
        try {
          const faces = await detectFaces(video);
          if (faces.length === 0) {
            stableCountRef.current = 0;
            lastDescriptorRef.current = null;
            livenessRef.current.reset();
            if (phase === "idle") {
              setMessage("Look at the camera — blink once (photos not allowed)");
            }
            return;
          }
          if (faces.length > 1) {
            stableCountRef.current = 0;
            livenessRef.current.reset();
            setMessage("Only one person at a time");
            return;
          }

          const face = faces[0]!;
          livenessRef.current.push({
            ear: face.ear,
            centerX: face.box.x + face.box.width / 2,
            centerY: face.box.y + face.box.height / 2,
            width: face.box.width,
            height: face.box.height,
          });

          // Anti-spoof: require a real blink before matching (blocks still photos)
          const live = livenessRef.current.requireBlink();
          if (!live.passed) {
            stableCountRef.current = 0;
            lastDescriptorRef.current = null;
            setMessage(live.hint);
            return;
          }

          lastDescriptorRef.current = face.descriptor;
          stableCountRef.current += 1;
          setMessage(
            `Verified — hold still… ${stableCountRef.current}/${STABLE_FRAMES}`,
          );

          if (stableCountRef.current >= STABLE_FRAMES) {
            const descriptor = lastDescriptorRef.current;
            stableCountRef.current = 0;
            livenessRef.current.reset();
            if (descriptor) await clockIn(descriptor);
          }
        } catch {
          // ignore transient detection errors
        } finally {
          detectingRef.current = false;
        }
      })();
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(id);
  }, [clockIn, phase, secretReady]);

  function saveSecret(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("kiosk_secret", kioskSecret);
    setSecretReady(true);
  }

  if (!secretReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <form onSubmit={saveSecret} className="ys-card w-full max-w-md space-y-4 p-6">
          <p className="text-sm font-semibold">
            Yal<span className="ys-gradient-text">Sync</span> Attendance
          </p>
          <h1 className="text-xl font-semibold">Kiosk setup</h1>
          <p className="text-sm ys-muted">
            Enter the same <code className="text-[var(--primary-violet)]">KIOSK_SECRET</code>{" "}
            from <code className="text-[var(--primary-violet)]">.env.local</code>.
            Stored in this browser session only.
          </p>
          <input
            type="password"
            required
            value={kioskSecret}
            onChange={(e) => setKioskSecret(e.target.value)}
            placeholder="Kiosk secret"
            className="ys-input"
          />
          <button type="submit" className="ys-btn ys-btn-primary w-full h-11">
            Start kiosk
          </button>
        </form>
      </main>
    );
  }

  const overlayStyle =
    phase === "success"
      ? { background: "linear-gradient(135deg, rgba(5,150,105,0.92), rgba(52,211,153,0.88))" }
      : phase === "error"
        ? { background: "linear-gradient(135deg, rgba(185,28,28,0.92), rgba(248,113,113,0.85))" }
        : phase === "scanning"
          ? { background: "linear-gradient(135deg, rgba(147,51,234,0.88), rgba(99,102,241,0.85))" }
          : undefined;

  return (
    <main className="relative flex min-h-screen flex-col">
      <div className="ys-header flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
            YalSync Attendance Kiosk
          </p>
          <p className="text-sm ys-muted">
            {siteName} · {timezone}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums ys-gradient-text">
            {formatTimeLocal(now, timezone)}
          </p>
          <p className="text-sm ys-muted">{formatDateLocal(now, timezone)}</p>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-4">
        <div className="ys-card overflow-hidden p-1.5">
          <WebcamCapture
            onVideoReady={onVideoReady}
            className="aspect-video w-full rounded-[calc(var(--radius)-6px)]"
          />
        </div>

        {(phase === "success" || phase === "error" || phase === "scanning") && (
          <div
            className="absolute inset-4 flex flex-col items-center justify-center rounded-[var(--radius)] p-8 text-center shadow-2xl"
            style={overlayStyle}
          >
            {phase === "success" && result && (
              <>
                <p className="text-5xl font-bold tracking-tight">
                  {result.event_type === "in" ? "TIME IN" : "TIME OUT"}
                </p>
                <p className="mt-4 text-3xl font-medium">
                  {result.employee.full_name}
                </p>
                <p className="mt-2 font-mono text-white/80">
                  {result.employee.employee_code}
                </p>
                <p className="mt-4 text-lg">
                  {result.recorded_at_local ||
                    formatTimeLocal(
                      result.recorded_at,
                      result.timezone || timezone,
                    )}
                </p>
              </>
            )}
            {phase !== "success" && (
              <p className="text-3xl font-semibold">{message}</p>
            )}
          </div>
        )}
      </div>

      <div className="px-6 pb-8 text-center">
        <p className="text-xl text-[var(--text-secondary)]">{message}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Press F11 for fullscreen. Photos / phone screens are rejected — blink to verify.
        </p>
      </div>
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          Loading kiosk…
        </div>
      }
    >
      <KioskInner />
    </Suspense>
  );
}
