import { useEffect, useState } from "react";

const STORAGE_KEY = "phase2_confidence_threshold";
const DEFAULT_THRESHOLD = 80;

function parseThreshold(rawValue: string | null): number {
  if (!rawValue) return DEFAULT_THRESHOLD;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
}

export function usePhase2Confidence(initialValue: number = DEFAULT_THRESHOLD) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    return parseThreshold(localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(confidenceThreshold));
    }
  }, [confidenceThreshold]);

  return { confidenceThreshold, setConfidenceThreshold };
}
