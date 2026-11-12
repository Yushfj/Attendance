export type Point = { x: number; y: number };

export type LivenessSample = {
  ear: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  at: number;
};

export type LivenessStatus = {
  passed: boolean;
  blinked: boolean;
  moved: boolean;
  hint: string;
  /** Latest eye aspect ratio — useful for tuning */
  ear?: number;
  baseline?: number;
};

function dist(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Eye aspect ratio from 6 landmark points (face-api left/right eye). */
export function eyeAspectRatio(eye: Point[]): number {
  if (eye.length < 6) return 1;
  const v1 = dist(eye[1]!, eye[5]!);
  const v2 = dist(eye[2]!, eye[4]!);
  const h = dist(eye[0]!, eye[3]!);
  if (h < 1e-6) return 1;
  return (v1 + v2) / (2 * h);
}

export function averageEar(leftEye: Point[], rightEye: Point[]) {
  return (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
}

/**
 * Adaptive blink + motion tracker.
 * Uses a rolling open-eye baseline so different eye shapes / cameras still work.
 * Photos usually fail because they never produce a real close→open EAR drop.
 */
export class LivenessTracker {
  private samples: LivenessSample[] = [];
  private baselineSamples: number[] = [];
  private baseline = 0;
  private sawClosed = false;
  private closedFrames = 0;
  private blinked = false;
  private moved = false;
  private readonly maxSamples: number;

  constructor(opts?: { maxSamples?: number }) {
    this.maxSamples = opts?.maxSamples ?? 60;
  }

  reset() {
    this.samples = [];
    this.baselineSamples = [];
    this.baseline = 0;
    this.sawClosed = false;
    this.closedFrames = 0;
    this.blinked = false;
    this.moved = false;
  }

  private updateBaseline(ear: number) {
    // Build baseline from relatively open eyes only
    if (this.baseline === 0 || ear > this.baseline * 0.85) {
      this.baselineSamples.push(ear);
      if (this.baselineSamples.length > 15) this.baselineSamples.shift();
      const sum = this.baselineSamples.reduce((a, b) => a + b, 0);
      this.baseline = sum / this.baselineSamples.length;
    }
  }

  push(sample: Omit<LivenessSample, "at">) {
    const next: LivenessSample = { ...sample, at: Date.now() };
    this.samples.push(next);
    if (this.samples.length > this.maxSamples) this.samples.shift();

    this.updateBaseline(sample.ear);

    // Adaptive thresholds relative to this person's open-eye EAR
    const base = this.baseline || sample.ear;
    const closeCut = Math.max(0.12, base * 0.72);
    const openCut = Math.max(0.16, base * 0.88);

    if (sample.ear <= closeCut) {
      this.closedFrames += 1;
      // Require at least 1 closed frame (fast blinks OK with 200ms poll)
      if (this.closedFrames >= 1) this.sawClosed = true;
    } else {
      if (this.sawClosed && sample.ear >= openCut) {
        this.blinked = true;
        this.sawClosed = false;
        this.closedFrames = 0;
      } else if (!this.sawClosed) {
        this.closedFrames = 0;
      }
    }

    // Absolute fallback for very clear blinks (works even before baseline settles)
    if (!this.blinked && this.samples.length >= 4) {
      const recent = this.samples.slice(-8).map((s) => s.ear);
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      if (max > 0.18 && min < max * 0.7 && min < 0.22) {
        // Strong dip then recovery pattern in the window
        const minIdx = recent.indexOf(min);
        const after = recent.slice(minIdx + 1);
        if (after.some((v) => v > min + (max - min) * 0.45)) {
          this.blinked = true;
        }
      }
    }

    if (this.samples.length >= 4) {
      const first = this.samples[Math.max(0, this.samples.length - 12)]!;
      const last = this.samples[this.samples.length - 1]!;
      const scale = Math.max(last.width, last.height, 1);
      const dx = Math.abs(last.centerX - first.centerX) / scale;
      const dy = Math.abs(last.centerY - first.centerY) / scale;
      if (dx + dy >= 0.028) this.moved = true;
    }
  }

  status(): LivenessStatus {
    return this.requireBlink();
  }

  /** Prefer blink; after enough observation, allow clear head turn as backup. */
  requireBlink(): LivenessStatus {
    const ear = this.samples[this.samples.length - 1]?.ear;

    if (this.blinked) {
      return {
        passed: true,
        blinked: true,
        moved: this.moved,
        hint: "Blink verified — hold still",
        ear,
        baseline: this.baseline || undefined,
      };
    }

    // Backup after ~2s of face time: deliberate head motion (still harder for a flat photo held still)
    if (this.moved && this.samples.length >= 10) {
      return {
        passed: true,
        blinked: false,
        moved: true,
        hint: "Motion verified — hold still",
        ear,
        baseline: this.baseline || undefined,
      };
    }

    if (this.baselineSamples.length < 3) {
      return {
        passed: false,
        blinked: false,
        moved: this.moved,
        hint: "Look straight at the camera…",
        ear,
        baseline: this.baseline || undefined,
      };
    }

    if (this.sawClosed) {
      return {
        passed: false,
        blinked: false,
        moved: this.moved,
        hint: "Good — now open your eyes",
        ear,
        baseline: this.baseline || undefined,
      };
    }

    return {
      passed: false,
      blinked: false,
      moved: this.moved,
      hint: "Blink clearly once (or slowly turn your head)",
      ear,
      baseline: this.baseline || undefined,
    };
  }
}
