import amqp from "amqplib";
import Redis from "ioredis";
import { config } from "./config";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function redisPingClient(): Redis {
  const r = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  r.on("error", () => undefined);
  return r;
}

async function pingRedisOnce(): Promise<void> {
  const r = redisPingClient();
  try {
    await r.connect();
    const pong = await r.ping();
    if (pong !== "PONG") throw new Error(`Redis PING unexpected: ${String(pong)}`);
  } finally {
    r.disconnect();
  }
}

async function pingRabbitOnce(): Promise<void> {
  const conn = await amqp.connect(config.rabbitUrl);
  try {
    await conn.close();
  } catch {
    /* ignore close errors */
  }
}

/**
 * Ждёт, пока RabbitMQ и Redis начнут принимать соединения (удобно после `docker compose up`).
 */
export async function waitForBrokers(): Promise<void> {
  const timeoutMs = config.brokerWaitTimeoutMs;
  const intervalMs = config.brokerWaitIntervalMs;
  const started = Date.now();
  let attempt = 0;

  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    try {
      await pingRedisOnce();
      await pingRabbitOnce();
      return;
    } catch {
      if (attempt === 1 || attempt % 5 === 0) {
        console.warn(
          "Брокеры ещё не готовы. Убедитесь, что выполнено: npm run up\n" +
            `Повтор через ${intervalMs}ms (лимит ${timeoutMs}ms)…`,
        );
      }
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `За ${timeoutMs}ms не удалось подключиться к RabbitMQ (${config.rabbitUrl}) ` +
      `и Redis (${config.redisUrl}). Запустите контейнеры: npm run up`,
  );
}
