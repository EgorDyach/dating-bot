import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { readEnv } from '../config/env';
import { FeedService } from '../feed/feed.service';
import { InteractionAction, InteractionsService } from '../interactions/interactions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot = new Telegraf(readEnv().botToken);
  private readonly lastShownByUser = new Map<string, string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
    private readonly feedService: FeedService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async onModuleInit() {
    this.bot.start(async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { isNew, user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        username: actor.username,
        firstName: actor.first_name,
        lastName: actor.last_name,
        languageCode: actor.language_code,
      });
      const name = actor.first_name || actor.username || 'друг';
      if (isNew) {
        await ctx.reply(
          `Привет, ${name}.\n\nРегистрация завершена (id ${user.id}).\n` +
            'Этап 3 активирован: доступны команды /profile, /feed, /like, /skip.',
        );
      } else {
        await ctx.reply(`С возвращением, ${name}. Твои данные обновлены (id ${user.id}).`);
      }
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'Команды:\n' +
          '/start - регистрация\n' +
          '/profile Имя|Город|О себе - upsert анкеты\n' +
          '/feed - показать следующую анкету\n' +
          '/like - лайк последней анкеты\n' +
          '/skip - пропуск последней анкеты',
      );
    });

    this.bot.command('profile', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const user = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        username: actor.username,
        firstName: actor.first_name,
        lastName: actor.last_name,
        languageCode: actor.language_code,
      });

      const raw = ctx.message.text.replace('/profile', '').trim();
      const [displayName, city, bio] = raw.split('|').map((x) => x?.trim() ?? '');
      if (!displayName) {
        await ctx.reply('Формат: /profile Имя|Город|О себе');
        return;
      }
      const profile = await this.profilesService.upsertOwnProfile(user.user.id, {
        displayName,
        city,
        bio,
      });
      await ctx.reply(
        `Анкета сохранена:\n` +
          `Имя: ${profile.displayName}\n` +
          `Город: ${profile.city || '-'}\n` +
          `Completeness: ${profile.profileCompleteness}%`,
      );
    });

    this.bot.command('feed', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const user = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        username: actor.username,
        firstName: actor.first_name,
        lastName: actor.last_name,
        languageCode: actor.language_code,
      });
      const candidate = await this.feedService.getNextProfile(user.user.id);
      if (!candidate) {
        await ctx.reply('Пока нет подходящих анкет. Заполни профиль и попробуй позже.');
        return;
      }

      this.lastShownByUser.set(user.user.id, candidate.userId);
      await ctx.reply(
        `Кандидат:\n` +
          `Имя: ${candidate.displayName}\n` +
          `Город: ${candidate.city || '-'}\n` +
          `О себе: ${candidate.bio || '-'}\n` +
          `Рейтинг: ${candidate.combinedScore.toFixed(2)}\n\n` +
          'Ответь /like или /skip',
      );
    });

    this.bot.command('like', async (ctx) => this.handleReaction(ctx.from?.id, 'like', ctx.reply.bind(ctx)));
    this.bot.command('skip', async (ctx) => this.handleReaction(ctx.from?.id, 'skip', ctx.reply.bind(ctx)));

    await this.bot.launch();
    this.logger.log('telegram polling started');
  }

  async onModuleDestroy() {
    await this.bot.stop();
  }

  private async handleReaction(
    telegramId: number | undefined,
    action: InteractionAction,
    reply: (message: string) => Promise<unknown>,
  ): Promise<void> {
    if (!telegramId) return;
    const { user } = await this.usersService.registerOrUpdateTelegramUser({ telegramId });
    const targetId = this.lastShownByUser.get(user.id);
    if (!targetId) {
      await reply('Сначала вызови /feed, чтобы получить анкету.');
      return;
    }

    await this.interactionsService.react(user.id, targetId, action);
    this.lastShownByUser.delete(user.id);
    await reply(action === 'like' ? 'Лайк сохранен и отправлен в очередь.' : 'Пропуск сохранен.');
  }
}
