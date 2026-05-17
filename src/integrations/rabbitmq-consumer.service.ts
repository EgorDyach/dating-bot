import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Channel, ChannelModel, connect, ConsumeMessage } from 'amqplib';
import { readEnv } from '../config/env';
import { MatchesService } from '../matches/matches.service';
import { UsersService } from '../users/users.service';
import { ProfilesService } from '../profiles/profiles.service';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class RabbitMqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly env = readEnv();
  private bot: Telegraf;

  constructor(
    private readonly matchesService: MatchesService,
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
  ) {
    const botOptions = this.createBotOptions(this.env);
    this.bot = new Telegraf(this.env.botToken, botOptions);
  }

  private createBotOptions(env: ReturnType<typeof readEnv>) {
    if (!env.proxyServer || !env.proxyPort) {
      return {};
    }

    try {
      const proxyUrl = `http://${env.proxyServer}:${env.proxyPort}`;
      const agent = new (require('https-proxy-agent'))(proxyUrl);
      return {
        telegram: {
          agent,
        },
      };
    } catch (err) {
      this.logger.warn(`Ошибка при создании прокси агента: ${err.message}, продолжаю без прокси`);
      return {};
    }
  }

  async onModuleInit() {
    const connection = await connect(this.env.rabbitMqUrl);
    const channel = await connection.createChannel();

    // Declare exchange
    await channel.assertExchange(this.env.rabbitMqExchange, 'topic', { durable: true });

    // Declare queue
    const queue = await channel.assertQueue('interactions_queue', { durable: true });

    // Bind queue to exchange
    await channel.bindQueue(queue.queue, this.env.rabbitMqExchange, 'interaction.changed');

    this.connection = connection;
    this.channel = channel;

    // Start consuming messages
    await channel.consume(queue.queue, (msg) => this.handleMessage(msg), { noAck: false });

    this.logger.log(`RabbitMQ consumer запущен, queue=${queue.queue}`);
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.channel) return;

    try {
      const content = msg.content.toString();
      const payload = JSON.parse(content);

      this.logger.debug(`Получено событие: ${JSON.stringify(payload)}`);

      if (payload.action === 'like') {
        await this.handleLikeEvent(payload.viewerId, payload.viewedId);
      } else if (payload.action === 'skip') {
        this.logger.debug(`Skip событие от ${payload.viewerId} к ${payload.viewedId}`);
      } else if (payload.action === 'superlike') {
        this.logger.debug(`Superlike событие от ${payload.viewerId} к ${payload.viewedId}`);
      }

      // Acknowledge message after processing
      this.channel!.ack(msg);
    } catch (err) {
      this.logger.error(`Ошибка обработки сообщения: ${err.message}`, err.stack);
      // Reject message and requeue
      this.channel!.nack(msg, false, true);
    }
  }

  private async handleLikeEvent(viewerId: string, viewedId: string): Promise<void> {
    try {
      // Check if it's a mutual like
      const isMutual = await this.matchesService.createMatchIfMutualLike(viewerId, viewedId);

      if (isMutual) {
        this.logger.log(`Матч найден между ${viewerId} и ${viewedId}`);
        await this.sendMatchNotification(viewedId, viewerId);
        await this.sendMatchNotification(viewerId, viewedId);
      }
    } catch (err) {
      this.logger.error(`Ошибка при обработке like события: ${err.message}`, err.stack);
    }
  }

  private async sendMatchNotification(notifiedUserId: string, likerUserId: string): Promise<void> {
    try {
      const notifiedUser = await this.usersService.findById(notifiedUserId);
      if (!notifiedUser || !notifiedUser.telegramId) {
        this.logger.warn(`Пользователь ${notifiedUserId} не имеет telegramId`);
        return;
      }

      const likerProfile = await this.profilesService.getByUserId(likerUserId);
      const displayName = likerProfile?.displayName || 'Пользователь';

      await this.bot.telegram.sendMessage(
        Number(notifiedUser.telegramId),
        `🎉 Это совпадение!\nВы понравились ${displayName}. Откройте матчи, чтобы начать общение.`,
        Markup.inlineKeyboard([[Markup.button.callback('❤️ Мои матчи', 'menu:matches')]]),
      );

      this.logger.log(`Уведомление отправлено пользователю ${notifiedUserId}`);
    } catch (err) {
      this.logger.error(`Ошибка при отправке уведомления пользователю ${notifiedUserId}: ${err.message}`, err.stack);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('RabbitMQ consumer остановлен');
  }
}
