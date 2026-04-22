import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBroker } from "./brokers/factory";
import { config } from "./config";
import { createBenchMessage } from "./message";
import { DegradationTracker, MetricsCollector } from "./metrics/collector";
import {
  buildDefaultScenarioMatrix,
  buildFullScenarioMatrix,
  buildSmokeScenarios,
} from "./scenarios";
import type { BrokerKind, RunResult, Scenario } from "./types";
import { waitForBrokers } from "./wait-for-brokers";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runProducers(
  adapter: { publish: (m: ReturnType<typeof createBenchMessage>) => Promise<void> },
  scenario: Scenario,
  metrics: MetricsCollector,
): Promise<void> {
  const deadline = Date.now() + scenario.durationSec * 1000;
  const perProducerRate = scenario.targetMsgPerSec / scenario.producerCount;
  const gapMs = 1000 / Math.max(perProducerRate, 0.001);

  const worker = async (workerIdx: number) => {
    const stagger = (gapMs / scenario.producerCount) * workerIdx;
    let nextTick = Date.now() + stagger;

    while (Date.now() < deadline) {
      const now = Date.now();
      if (now < nextTick) {
        await sleep(nextTick - now);
      }
      try {
        const msg = createBenchMessage(scenario.payloadBytes);
        await adapter.publish(msg);
        metrics.recordSent();
      } catch {
        metrics.recordPublishError();
      }
      nextTick += gapMs;
    }
  };

  await Promise.all(
    Array.from({ length: scenario.producerCount }, (_, i) => worker(i)),
  );
}

async function drainUntilIdle(
  metrics: MetricsCollector,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (metrics.getBacklog() === 0) return;
    await sleep(25);
  }
}

export async function runOneScenario(
  broker: BrokerKind,
  scenario: Scenario,
): Promise<RunResult> {
  const adapter = createBroker(broker);
  const metrics = new MetricsCollector();
  const degradation = new DegradationTracker();
  const runId = `${broker}-${scenario.id}-${Date.now()}`;
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  await adapter.connect();
  await adapter.reset();

  const stopConsumers = await adapter.startConsumers(
    scenario.consumerCount,
    (lat) => metrics.recordConsume(lat),
    () => metrics.recordConsumeError(),
  );

  const sampler = setInterval(() => {
    void (async () => {
      const backlog = metrics.getBacklog();
      let depth: number | null = null;
      try {
        depth = await adapter.getApproximateDepth();
      } catch {
        depth = null;
      }
      degradation.sample({
        backlog,
        depth,
        p95: metrics.getP95(),
        errorRate: metrics.getErrorRate(),
      });
    })();
  }, config.sampleIntervalMs);

  await runProducers(adapter, scenario, metrics);
  await drainUntilIdle(metrics, config.drainTimeoutSec * 1000);

  clearInterval(sampler);
  await stopConsumers();
  await adapter.disconnect();

  const finishedAt = new Date();
  const wallMs = finishedAt.getTime() - startedAt.getTime();
  const wallTimeSec = wallMs / 1000;

  const lat = metrics.getLatencyStats();
  const lost = Math.max(0, metrics.sent - metrics.consumed);
  const deg = degradation.summary();

  return {
    runId,
    startedAtIso,
    finishedAtIso: finishedAt.toISOString(),
    broker,
    scenario,
    messagesSent: metrics.sent,
    messagesConsumed: metrics.consumed,
    publishErrors: metrics.publishErrors,
    consumeErrors: metrics.consumeErrors,
    lost,
    throughputSentPerSec: wallTimeSec > 0 ? metrics.sent / wallTimeSec : 0,
    throughputConsumedPerSec: wallTimeSec > 0 ? metrics.consumed / wallTimeSec : 0,
    latency: {
      samples: lat.samples,
      avgMs: lat.avgMs,
      p95Ms: lat.p95Ms,
      maxMs: lat.maxMs,
    },
    wallTimeSec,
    degraded: deg.degraded,
    degradationReasons: deg.reasons,
    depthSamples: degradation.depthSamples.length > 0 ? degradation.depthSamples : undefined,
  };
}

async function writeResultJson(result: RunResult, outDir: string): Promise<void> {
  const name = `${result.broker}-${result.scenario.id}-${result.runId}.json`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );
  await writeFile(path.join(outDir, name), JSON.stringify(result, null, 2), "utf8");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function writeSummaryCsv(rows: RunResult[], outDir: string): Promise<void> {
  const header = [
    "broker",
    "scenario_id",
    "label",
    "payload_bytes",
    "target_msg_per_sec",
    "duration_sec",
    "messages_sent",
    "messages_consumed",
    "lost",
    "publish_errors",
    "consume_errors",
    "throughput_sent_per_sec",
    "throughput_consumed_per_sec",
    "latency_avg_ms",
    "latency_p95_ms",
    "latency_max_ms",
    "degraded",
    "degradation_reasons",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.broker,
        r.scenario.id,
        csvEscape(r.scenario.label),
        String(r.scenario.payloadBytes),
        String(r.scenario.targetMsgPerSec),
        String(r.scenario.durationSec),
        String(r.messagesSent),
        String(r.messagesConsumed),
        String(r.lost),
        String(r.publishErrors),
        String(r.consumeErrors),
        String(r.throughputSentPerSec.toFixed(2)),
        String(r.throughputConsumedPerSec.toFixed(2)),
        String(r.latency.avgMs.toFixed(2)),
        String(r.latency.p95Ms.toFixed(2)),
        String(r.latency.maxMs.toFixed(2)),
        String(r.degraded),
        csvEscape(r.degradationReasons.join(";")),
      ].join(","),
    ),
  ];

  await writeFile(path.join(outDir, "summary.csv"), lines.join("\n"), "utf8");
}

export async function runBenchmarkSuite(): Promise<void> {
  const outDir = path.join(process.cwd(), "results");
  await mkdir(outDir, { recursive: true });

  const smoke = process.env.BENCH_SMOKE === "1";
  const full = process.env.BENCH_FULL === "1";
  const scenarios = smoke
    ? buildSmokeScenarios()
    : full
      ? buildFullScenarioMatrix()
      : buildDefaultScenarioMatrix();
  const brokers: BrokerKind[] = ["rabbitmq", "redis"];

  console.log(
    smoke
      ? "Running SMOKE scenarios"
      : full
        ? "Running FULL scenario matrix"
        : "Running DEFAULT reduced matrix (set BENCH_FULL=1 for full matrix)",
  );

  console.log("Проверка RabbitMQ и Redis (см. npm run up)…");
  await waitForBrokers();

  const all: RunResult[] = [];

  for (const scenario of scenarios) {
    for (const broker of brokers) {
      console.log(`\n=== ${broker} :: ${scenario.label} ===`);
      try {
        const res = await runOneScenario(broker, scenario);
        all.push(res);
        await writeResultJson(res, outDir);
        console.log(
          `sent=${res.messagesSent} consumed=${res.messagesConsumed} lost=${res.lost} ` +
            `consume_tput=${res.throughputConsumedPerSec.toFixed(1)} msg/s p95=${res.latency.p95Ms.toFixed(
              1,
            )}ms degraded=${res.degraded}`,
        );
      } catch (e) {
        console.error(`FAILED ${broker} ${scenario.id}:`, e);
      }
    }
  }

  await writeSummaryCsv(all, outDir);
  console.log(`\nWrote ${all.length} runs under ${outDir} and summary.csv`);
}
