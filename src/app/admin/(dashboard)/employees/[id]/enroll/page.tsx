"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebcamCapture } from "@/components/WebcamCapture";
import { detectSingleFace, loadFaceModels } from "@/lib/face/client";
import { LivenessTracker } from "@/lib/face/liveness";

const SAMPLE_TARGET = 3;

export default function EnrollFacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params.id;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const livenessRef = useRef(new LivenessTracker());
  const watchRef = useRef<number | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessHint, setLivenessHint] = useState(
    "Blink once to prove you're real — photos are not allowed",
  );
  const [status, setStatus] = useState("Loading face models…");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeeName, setEmployeeName] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        await loadFaceModels();
        setModelsReady(true);
        setStatus("Complete liveness, then capture samples");
      } catch {
        setError(
          "Failed to load face models. Ensure /public/models contains face-api weights.",
        );
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/employees");
      const json = (await res.json()) as {
        employees?: { id: string; full_name: string }[];
      };
      const emp = json.employees?.find((e) => e.id === employeeId);
      if (emp) setEmployeeName(emp.full_name);
    })();
  }, [employeeId]);

  const onVideoReady = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
  }, []);

  // Continuous liveness watch — must blink before enrollment captures
  useEffect(() => {
    if (!modelsReady || livenessPassed) return;

    watchRef.current = window.setInterval(() => {
      void (async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const face = await detectSingleFace(video);
          if (!face) {
            setLivenessHint("Show one face, then blink — photos are not allowed");
            return;
          }
          livenessRef.current.push({
            ear: face.ear,
            centerX: face.box.x + face.box.width / 2,
            centerY: face.box.y + face.box.height / 2,
            width: face.box.width,
            height: face.box.height,
          });
          const live = livenessRef.current.requireBlink();
          setLivenessHint(live.hint);
          if (live.passed) {
            setLivenessPassed(true);
            setStatus("Liveness verified — capture 3 samples");
            if (watchRef.current) {
              clearInterval(watchRef.current);
              watchRef.current = null;
            }
          }
        } catch {
          // ignore
        }
      })();
    }, 200);

    return () => {
      if (watchRef.current) clearInterval(watchRef.current);
    };
  }, [modelsReady, livenessPassed]);

  async function captureSample() {
    setError(null);
    if (!videoRef.current || !modelsReady) return;
    if (!livenessPassed) {
      setError("Blink first to prove you're real. Photos cannot be enrolled.");
      return;
    }
    try {
      const face = await detectSingleFace(videoRef.current);
      if (!face) {
        setError("Need exactly one clear face in frame");
        return;
      }
      setSamples((prev) => [...prev, face.descriptor].slice(0, SAMPLE_TARGET));
      setStatus(`Captured ${(samples.length + 1).toString()} / ${SAMPLE_TARGET}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed");
    }
  }

  async function saveEnrollment() {
    if (samples.length === 0) return;
    if (!livenessPassed) {
      setError("Liveness check required before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: samples }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed");
      setStatus("Enrollment saved");
      router.push("/admin/employees");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetLiveness() {
    livenessRef.current.reset();
    setLivenessPassed(false);
    setSamples([]);
    setLivenessHint("Blink once to prove you're real — photos are not allowed");
    setStatus("Complete liveness, then capture samples");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/employees"
          className="text-sm text-[var(--primary-violet)] hover:underline"
        >
          ← Employees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Enroll face{employeeName ? `: ${employeeName}` : ""}
        </h1>
        <p className="mt-1 text-sm ys-muted">
          Photos and phone screens are blocked. Blink to verify, then capture{" "}
          {SAMPLE_TARGET} samples.
        </p>
      </div>

      <div className="ys-card max-w-2xl overflow-hidden p-2">
        <WebcamCapture
          onVideoReady={onVideoReady}
          className="aspect-video w-full rounded-[calc(var(--radius)-4px)]"
        />
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          livenessPassed
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
        }`}
      >
        {livenessPassed
          ? "Liveness verified — live person confirmed"
          : livenessHint}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!modelsReady || !livenessPassed || samples.length >= SAMPLE_TARGET}
          onClick={() => void captureSample()}
          className="ys-btn ys-btn-primary"
        >
          Capture sample ({samples.length}/{SAMPLE_TARGET})
        </button>
        <button
          type="button"
          onClick={resetLiveness}
          className="ys-btn ys-btn-secondary"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={!livenessPassed || samples.length < SAMPLE_TARGET || saving}
          onClick={() => void saveEnrollment()}
          className="ys-btn ys-btn-primary"
          style={{
            background: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
            boxShadow: "0 4px 16px rgba(52, 211, 153, 0.3)",
          }}
        >
          {saving ? "Saving…" : "Save enrollment"}
        </button>
      </div>

      <p className="text-sm ys-muted">{status}</p>
      {error && <p className="ys-alert-error">{error}</p>}
    </div>
  );
}
