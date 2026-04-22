import "dotenv/config";

function num(env: string | undefined, fallback: number): number {
  if (env === undefined || env === "") return fallback;
  const n = Number(env);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  rabbitUrl: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
  rabbitQueue: process.env.RABBITMQ_QUEUE ?? "bench.queue",

  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  redisStreamKey: process.env.REDIS_STREAM_KEY ?? "bench:stream",
  redisConsumerGroup: process.env.REDIS_CONSUMER_GROUP ?? "bench-group",

  drainTimeoutSec: num(process.env.DRAIN_TIMEOUT_SEC, 120),

  degradeP95LatencyMs: num(process.env.DEGRADE_P95_LATENCY_MS, 5000),
  degradeErrorRate: num(process.env.DEGRADE_ERROR_RATE, 0.01),
  degradeBacklogGrowSamples: num(process.env.DEGRADE_BACKLOG_GROW_SAMPLES, 10),
  sampleIntervalMs: num(process.env.DEGRADE_SAMPLE_INTERVAL_MS, 200),

  /** Cap stored latencies to bound memory on long runs */
  maxLatencySamples: num(process.env.MAX_LATENCY_SAMPLES, 200_000),

  /** Ожидание брокеров перед серией прогонов (после `docker compose up`) */
  brokerWaitTimeoutMs: num(process.env.BROKER_WAIT_TIMEOUT_MS, 120_000),
  brokerWaitIntervalMs: num(process.env.BROKER_WAIT_INTERVAL_MS, 2000),
};
