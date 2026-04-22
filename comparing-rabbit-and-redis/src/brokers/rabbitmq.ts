import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import amqp from "amqplib";
import { config } from "../config";
import type { BenchMessage } from "../types";
import type { IBrokerAdapter } from "./broker";

export class RabbitMqBroker implements IBrokerAdapter {
  readonly kind = "rabbitmq" as const;

  private connection: ChannelModel | null = null;
  private publishChannel: Channel | null = null;

  async connect(): Promise<void> {
    this.connection = await amqp.connect(config.rabbitUrl);
    this.publishChannel = await this.connection.createChannel();
    await this.publishChannel.assertQueue(config.rabbitQueue, { durable: true });
  }

  async reset(): Promise<void> {
    if (!this.publishChannel) throw new Error("RabbitMQ: not connected");
    await this.publishChannel.purgeQueue(config.rabbitQueue);
  }

  async disconnect(): Promise<void> {
    if (this.publishChannel) {
      await this.publishChannel.close().catch(() => undefined);
      this.publishChannel = null;
    }
    if (this.connection) {
      await this.connection.close().catch(() => undefined);
      this.connection = null;
    }
  }

  async publish(message: BenchMessage): Promise<void> {
    if (!this.publishChannel) throw new Error("RabbitMQ: not connected");
    const ok = this.publishChannel.sendToQueue(
      config.rabbitQueue,
      Buffer.from(JSON.stringify(message), "utf8"),
      { persistent: true, contentType: "application/json" },
    );
    if (!ok) {
      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("RabbitMQ: publish drain timeout")), 30_000);
        this.publishChannel!.once("drain", () => {
          clearTimeout(to);
          resolve();
        });
      });
    }
  }

  async startConsumers(
    count: number,
    onMessage: (latencyMs: number) => void,
    onConsumeError: () => void,
  ): Promise<() => Promise<void>> {
    if (!this.connection) throw new Error("RabbitMQ: not connected");

    const stoppers: Array<() => Promise<void>> = [];

    for (let i = 0; i < count; i++) {
      const ch = await this.connection.createChannel();
      await ch.assertQueue(config.rabbitQueue, { durable: true });
      await ch.prefetch(100);

      const { consumerTag } = await ch.consume(
        config.rabbitQueue,
        (msg: ConsumeMessage | null) => {
          void (async () => {
            if (!msg) return;
            try {
              const body = JSON.parse(msg.content.toString("utf8")) as BenchMessage;
              const latencyMs = Date.now() - body.sentAtMs;
              onMessage(latencyMs);
              ch.ack(msg);
            } catch {
              onConsumeError();
              ch.nack(msg, false, true);
            }
          })();
        },
        { noAck: false },
      );

      stoppers.push(async () => {
        await ch.cancel(consumerTag);
        await ch.close();
      });
    }

    return async () => {
      await Promise.all(stoppers.map((s) => s()));
    };
  }

  async getApproximateDepth(): Promise<number | null> {
    return null;
  }
}
