export type BrokerKind = "rabbitmq" | "redis";

export interface BenchMessage {
  id: string;
  sentAtMs: number;
  payload: string;
}

export interface Scenario {
  id: string;
  label: string;
  /** Wall-clock duration producers are active */
  durationSec: number;
  /** Target aggregate publish rate (all producers) */
  targetMsgPerSec: number;
  /** Approximate JSON payload string length (pad field) */
  payloadBytes: number;
  producerCount: number;
  consumerCount: number;
}

export interface LatencyStats {
  samples: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface RunResult {
  runId: string;
  startedAtIso: string;
  finishedAtIso: string;
  broker: BrokerKind;
  scenario: Scenario;
  messagesSent: number;
  messagesConsumed: number;
  publishErrors: number;
  consumeErrors: number;
  lost: number;
  throughputSentPerSec: number;
  throughputConsumedPerSec: number;
  latency: LatencyStats;
  wallTimeSec: number;
  degraded: boolean;
  degradationReasons: string[];
  /** Optional broker-specific depth samples (e.g. Redis XLEN) */
  depthSamples?: number[];
}
