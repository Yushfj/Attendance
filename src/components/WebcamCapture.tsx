"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onVideoReady?: (video: HTMLVideoElement) => void;
  className?: string;
  mirrored?: boolean;
};

function describeMediaError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Camera unavailable. Check Windows camera privacy settings and close other apps using the camera.";
  }
  const name = "name" in err ? String((err as DOMException).name) : err.name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission blocked. Click the lock/tune icon in the address bar → allow Camera → reload.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera found. Plug in a webcam or enable the built-in camera.";
    case "NotReadableError":
    case "TrackStartError":
      return "Camera is busy. Close Zoom/Teams/other tabs using the camera, then retry.";
    case "OverconstrainedError":
      return "Camera does not support the requested settings. Retrying with defaults…";
    case "SecurityError":
      return "Camera blocked by browser security. Use http://localhost:3000 (not an IP address).";
    default:
      return `${name}: ${err.message}`;
  }
}

/** Prefer color webcam over IR depth cameras on dual-camera laptops. */
async function pickPreferredDeviceId(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  // Need a temporary permission grant on some browsers before labels appear
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter((d) => d.kind === "videoinput");
  if (videos.length === 0) return undefined;

  const scored = videos.map((d) => {
    const label = (d.label || "").toLowerCase();
    let score = 0;
    if (label.includes("fhd") || label.includes("hd") || label.includes("rgb"))
      score += 5;
    if (label.includes("integrated") || label.includes("webcam")) score += 2;
    if (label.includes("front") || label.includes("user")) score += 1;
    if (label.includes("ir") || label.includes("infrared") || label.includes("tof"))
      score -= 10;
    return { id: d.deviceId, score, label };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id;
}

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "getUserMedia is not supported in this browser. Use Chrome or Edge.",
    );
  }

  // 1) Try preferred physical device (skip IR)
  try {
    const deviceId = await pickPreferredDeviceId();
    if (deviceId) {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    }
  } catch {
    // fall through
  }

  // 2) facingMode user
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
  } catch {
    // fall through
  }

  // 3) simplest request
  return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
}

export function WebcamCapture({
  onVideoReady,
  className = "",
  mirrored = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    setReady(false);
    stopStream();

    try {
      // Warm-up enumerate so labels are available after permission
      try {
        const warm = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        warm.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore; openCamera will surface the real error
      }

      const stream = await openCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setReady(true);
      onVideoReady?.(video);
    } catch (err) {
      setError(describeMediaError(err));
    } finally {
      setStarting(false);
    }
  }, [onVideoReady, stopStream]);

  useEffect(() => {
    void start();
    return () => stopStream();
  }, [start, retryKey, stopStream]);

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] bg-black ${className}`}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
          {starting ? "Starting camera…" : "Preparing camera…"}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
          <p className="max-w-md text-sm text-[var(--danger)]">{error}</p>
          <p className="max-w-md text-xs text-[var(--text-tertiary)]">
            Tip: use <strong className="text-white">http://localhost:3000</strong>
            , allow Camera in the site settings, and close other apps using the
            webcam (Zoom/Teams). ASUS laptops often have an IR camera — we try
            the FHD camera first.
          </p>
          <button
            type="button"
            className="ys-btn ys-btn-primary"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            Retry camera
          </button>
        </div>
      )}
    </div>
  );
}
