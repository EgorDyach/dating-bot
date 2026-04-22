import type { Scenario } from './types';

const producers = Number(process.env.BENCH_PRODUCERS ?? 1);
const consumers = Number(process.env.BENCH_CONSUMERS ?? 1);
const durationSec = Number(process.env.BENCH_DURATION_SEC ?? 30);

function base(
  id: string,
  label: string,
  payloadBytes: number,
  targetMsgPerSec: number,
): Scenario {
  return {
    id,
    label,
    durationSec,
    targetMsgPerSec,
    payloadBytes,
    producerCount: producers,
    consumerCount: consumers,
  };
}

/** Full matrix from practice brief */
export function buildFullScenarioMatrix(): Scenario[] {
  const sizes = [
    { id: '128b', bytes: 128 },
    { id: '1kb', bytes: 1024 },
    { id: '10kb', bytes: 10 * 1024 },
    { id: '100kb', bytes: 100 * 1024 },
  ];
  const rates = [1000, 5000, 10_000];

  const scenarios: Scenario[] = [];

  for (const r of rates) {
    for (const s of sizes) {
      scenarios.push(
        base(`rate-${r}-payload-${s.id}`, `${r} msg/s, ${s.id}`, s.bytes, r),
      );
    }
  }

  return scenarios;
}

/** Reduced default matrix to speed up local runs */
export function buildDefaultScenarioMatrix(): Scenario[] {
  const sizes = [
    { id: '1kb', bytes: 1024 },
    { id: '10kb', bytes: 10 * 1024 },
    { id: '100kb', bytes: 100 * 1024 },
  ];
  const rates = [1000, 5000, 15000];

  const scenarios: Scenario[] = [];
  for (const r of rates) {
    for (const s of sizes) {
      scenarios.push(
        base(`rate-${r}-payload-${s.id}`, `${r} msg/s, ${s.id}`, s.bytes, r),
      );
    }
  }
  return scenarios;
}

/** Smaller smoke set for CI / quick check */
export function buildSmokeScenarios(): Scenario[] {
  return [
    base('smoke-small', 'smoke 500 msg/s, 128B', 128, 500),
    base('smoke-medium', 'smoke 2000 msg/s, 1KB', 1024, 2000),
  ];
}
