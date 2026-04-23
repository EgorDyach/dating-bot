import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Channel, ChannelModel, connect } from 'amqplib';
import { readEnv } from '../config/env';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly env = readEnv();

  async onModuleInit() {
    const connection = await connect(this.env.rabbitMqUrl);
    const channel = await connection.createChannel();
    await channel.assertExchange(this.env.rabbitMqExchange, 'topic', { durable: true });
    this.connection = connection;
    this.channel = channel;
    this.logger.log(`connected to rabbitmq, exchange=${this.env.rabbitMqExchange}`);
  }

  async publishInteraction(payload: Record<string, unknown>) {
    if (!this.channel) return;
    this.channel.publish(
      this.env.rabbitMqExchange,
      'interaction.changed',
      Buffer.from(JSON.stringify(payload)),
      { contentType: 'application/json', persistent: true },
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
