import "dotenv/config";
import { createBroker } from "./brokers/factory";
import type { BrokerKind } from "./types";

async function main(): Promise<void> {
  const kind = process.argv[2] as BrokerKind;
  if (kind !== "rabbitmq" && kind !== "redis") {
    console.error(
      "Usage: npm run consumer -- <rabbitmq|redis> [durationSec] [consumerCount]",
    );
    process.exit(1);
  }

  const durationSec = Number(process.argv[3] ?? 30);
  const consumerCount = Math.max(1, Math.floor(Number(process.argv[4] ?? 1)));

  const broker = createBroker(kind);
  await broker.connect();
  // Не делаем reset — читаем то, что уже в брокере.

  let consumed = 0;
  const stopConsumers = await broker.startConsumers(
    consumerCount,
    () => {
      consumed += 1;
    },
    () => {
      /* consume error */
    },
  );

  await new Promise((r) => setTimeout(r, durationSec * 1000));
  await stopConsumers();
  await broker.disconnect();

  console.log(`Consumed ${consumed} messages from ${kind} (${consumerCount} workers)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
