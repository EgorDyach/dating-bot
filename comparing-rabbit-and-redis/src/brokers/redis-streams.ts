import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { config } from '../config';
import type { BenchMessage } from '../types';
import type { IBrokerAdapter } from './broker';

function redisOptions() {
  return {
    maxRetriesPerRequest: null as null,
    connectTimeout: 10_000,
    enableOfflineQueue: true,
  };
}

function quietErrors(client: Redis): void {
  client.on('error', () => undefined);
}

export class RedisStreamsBroker implements IBrokerAdapter {
  readonly kind = 'redis' as const;

  private client: Redis | null = null;
  private consumerClients: Redis[] = [];

  async connect(): Promise<void> {
    this.client = new Redis(config.redisUrl, redisOptions());
    quietErrors(this.client);
    await this.ensureGroup();
  }

  private async ensureGroup(): Promise<void> {
    if (!this.client) throw new Error('Redis: not connected');
    try {
      await this.client.xgroup(
        'CREATE',
        config.redisStreamKey,
        config.redisConsumerGroup,
        '0',
        'MKSTREAM',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('BUSYGROUP')) throw e;
    }
  }

  async reset(): Promise<void> {
    if (!this.client) throw new Error('Redis: not connected');
    await this.client.del(config.redisStreamKey);
    await this.ensureGroup();
  }

  async disconnect(): Promise<void> {
    for (const c of this.consumerClients) {
      await c.quit().catch(() => undefined);
    }
    this.consumerClients = [];
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  async publish(message: BenchMessage): Promise<void> {
    if (!this.client) throw new Error('Redis: not connected');
    await this.client.xadd(
      config.redisStreamKey,
      '*',
      'data',
      JSON.stringify(message),
    );
  }

  async startConsumers(
    count: number,
    onMessage: (latencyMs: number) => void,
    onConsumeError: () => void,
  ): Promise<() => Promise<void>> {
    if (!this.client) throw new Error('Redis: not connected');

    const suffix = randomBytes(4).toString('hex');
    const stopFlags = Array.from({ length: count }, () => ({ stop: false }));
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const sub = this.client.duplicate(redisOptions());
      quietErrors(sub);
      this.consumerClients.push(sub);
      const consumerName = `c-${suffix}-${i}`;

      tasks.push(
        (async () => {
          while (!stopFlags[i]!.stop) {
            try {
              const res = (await sub.xreadgroup(
                'GROUP',
                config.redisConsumerGroup,
                consumerName,
                'COUNT',
                50,
                'BLOCK',
                2000,
                'STREAMS',
                config.redisStreamKey,
                '>',
              )) as Array<[string, Array<[string, string[]]>]> | null;

              if (!res) continue;

              for (const [, entries] of res) {
                for (const [id, fields] of entries) {
                  try {
                    const map = fieldsToMap(fields);
                    const raw = map.get('data');
                    if (!raw) throw new Error('missing data field');
                    const body = JSON.parse(raw) as BenchMessage;
                    const latencyMs = Date.now() - body.sentAtMs;
                    onMessage(latencyMs);
                    await sub.xack(
                      config.redisStreamKey,
                      config.redisConsumerGroup,
                      id,
                    );
                  } catch {
                    onConsumeError();
                  }
                }
              }
            } catch {
              onConsumeError();
              await new Promise((r) => setTimeout(r, 50));
            }
          }
        })(),
      );
    }

    return async () => {
      for (const f of stopFlags) f.stop = true;
      await Promise.allSettled(tasks);
      for (const c of this.consumerClients) {
        await c.quit().catch(() => undefined);
      }
      this.consumerClients = [];
    };
  }

  async getApproximateDepth(): Promise<number | null> {
    if (!this.client) return null;
    const n = await this.client.xlen(config.redisStreamKey);
    return n;
  }
}

function fieldsToMap(fields: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) {
    m.set(fields[i]!, fields[i + 1]!);
  }
  return m;
}
