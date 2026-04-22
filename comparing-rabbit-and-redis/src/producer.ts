import "dotenv/config";
import { createBroker } from "./brokers/factory";
import { createBenchMessage } from "./message";
import type { BrokerKind } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const kind = process.argv[2] as BrokerKind;
  if (kind !== "rabbitmq" && kind !== "redis") {
    console.error(
      "Usage: npm run producer -- <rabbitmq|redis> [msgPerSec] [durationSec] [payloadBytes]",
    );
    process.exit(1);
  }

  const msgPerSec = Number(process.argv[3] ?? 1000);
  const durationSec = Number(process.argv[4] ?? 10);
  const payloadBytes = Number(process.argv[5] ?? 128);

  const broker = createBroker(kind);
  await broker.connect();
  await broker.reset();

  const deadline = Date.now() + durationSec * 1000;
  const gapMs = 1000 / Math.max(msgPerSec, 0.001);
  let next = Date.now();
  let published = 0;

  while (Date.now() < deadline) {
    const now = Date.now();
    if (now < next) await sleep(next - now);
    await broker.publish(createBenchMessage(payloadBytes));
    published += 1;
    next += gapMs;
  }

  await broker.disconnect();
  console.log(`Published ${published} messages to ${kind}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
