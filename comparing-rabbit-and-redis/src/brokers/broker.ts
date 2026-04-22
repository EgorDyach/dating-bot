import type { BenchMessage, BrokerKind } from "../types";

export interface IBrokerAdapter {
  readonly kind: BrokerKind;

  connect(): Promise<void>;
  /** Purge queue / stream before a run */
  reset(): Promise<void>;
  disconnect(): Promise<void>;

  publish(message: BenchMessage): Promise<void>;

  /**
   * Start `count` competing consumers.
   * `onMessage` receives end-to-end latency in ms (now - sentAtMs).
   */
  startConsumers(
    count: number,
    onMessage: (latencyMs: number) => void,
    onConsumeError: () => void,
  ): Promise<() => Promise<void>>;

  /** Best-effort queue/stream depth (null if unknown) */
  getApproximateDepth(): Promise<number | null>;
}
