import { randomUUID } from "node:crypto";
import type { BenchMessage } from "./types";

export function createBenchMessage(payloadBytes: number): BenchMessage {
  const n = Math.max(0, Math.floor(payloadBytes));
  const payload = n > 0 ? "x".repeat(n) : "";
  return {
    id: randomUUID(),
    sentAtMs: Date.now(),
    payload,
  };
}
