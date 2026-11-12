"use client";

import type * as FaceApi from "face-api.js";
import { averageEar, type Point } from "@/lib/face/liveness";

let faceapi: typeof FaceApi | null = null;
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function getFaceApi() {
  if (!faceapi) {
    faceapi = await import("face-api.js");
  }
  return faceapi;
}

/** Load SSD MobileNet + landmarks + recognition models from /models. */
export async function loadFaceModels(modelUrl = "/models"): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const api = await getFaceApi();
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(modelUrl),
      api.nets.faceLandmark68Net.loadFromUri(modelUrl),
      api.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);
    modelsLoaded = true;
  })();

  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

export type DetectedFace = {
  descriptor: number[];
  box: { x: number; y: number; width: number; height: number };
  ear: number;
  leftEye: Point[];
  rightEye: Point[];
};

function toPoints(
  pts: Array<{ x: number; y: number }>,
): Point[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

export async function detectFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<DetectedFace[]> {
  const api = await getFaceApi();
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const detections = await api
    .detectAllFaces(input, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => {
    const leftEye = toPoints(d.landmarks.getLeftEye());
    const rightEye = toPoints(d.landmarks.getRightEye());
    return {
      descriptor: Array.from(d.descriptor),
      box: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      ear: averageEar(leftEye, rightEye),
      leftEye,
      rightEye,
    };
  });
}

export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<DetectedFace | null> {
  const faces = await detectFaces(input);
  if (faces.length !== 1) return null;
  return faces[0]!;
}
