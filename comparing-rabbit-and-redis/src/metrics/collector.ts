import { config } from "../config";

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

export class MetricsCollector {
  sent = 0;
  consumed = 0;
  publishErrors = 0;
  consumeErrors = 0;
  private latencies: number[] = [];

  recordSent(): void {
    this.sent += 1;
  }

  recordPublishError(): void {
    this.publishErrors += 1;
  }

  recordConsume(latencyMs: number): void {
    this.consumed += 1;
    if (this.latencies.length < config.maxLatencySamples) {
      this.latencies.push(latencyMs);
    }
  }

  recordConsumeError(): void {
    this.consumeErrors += 1;
  }

  getBacklog(): number {
    return Math.max(0, this.sent - this.consumed);
  }

  getErrorRate(): number {
    const attempts = this.sent + this.publishErrors + this.consumed + this.consumeErrors;
    if (attempts === 0) return 0;
    return (this.publishErrors + this.consumeErrors) / attempts;
  }

  getP95(): number {
    if (this.latencies.length === 0) return 0;
    const copy = [...this.latencies].sort((a, b) => a - b);
    return percentile(copy, 95);
  }

  getLatencyStats(): { samples: number; avgMs: number; p95Ms: number; maxMs: number } {
    if (this.latencies.length === 0) {
      return { samples: 0, avgMs: 0, p95Ms: 0, maxMs: 0 };
    }
    const copy = [...this.latencies].sort((a, b) => a - b);
    const sum = copy.reduce((a, b) => a + b, 0);
    return {
      samples: copy.length,
      avgMs: sum / copy.length,
      p95Ms: percentile(copy, 95),
      maxMs: copy[copy.length - 1]!,
    };
  }
}

export class DegradationTracker {
  private lastBacklog = 0;
  private growStreak = 0;
  private readonly reasons = new Set<string>();
  readonly depthSamples: number[] = [];

  sample(input: { backlog: number; depth: number | null; p95: number; errorRate: number }): void {
    const depth = input.depth ?? input.backlog;
    this.depthSamples.push(depth);

    if (input.backlog > this.lastBacklog) this.growStreak += 1;
    else this.growStreak = 0;
    this.lastBacklog = input.backlog;

    if (this.growStreak >= config.degradeBacklogGrowSamples) {
      this.reasons.add("backlog_growing");
    }
    if (input.p95 >= config.degradeP95LatencyMs) {
      this.reasons.add("p95_latency");
    }
    if (input.errorRate >= config.degradeErrorRate) {
      this.reasons.add("error_rate");
    }
  }

  summary(): { degraded: boolean; reasons: string[] } {
    return {
      degraded: this.reasons.size > 0,
      reasons: [...this.reasons],
    };
  }
}
