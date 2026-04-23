import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { readEnv } from '../config/env';
import { FeedService } from '../feed/feed.service';
import { InteractionAction, InteractionsService } from '../interactions/interactions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';

type ProfileEditField = 'displayName' | 'bio' | 'city';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot = new Telegraf(readEnv().botToken);
  private readonly pendingProfileEditField = new Map<string, ProfileEditField>();
  private readonly waitingPhotoUpload = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
    private readonly feedService: FeedService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async onModuleInit() {
    await this.bot.telegram.setMyCommands([]);

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
            'Открывай приложение кнопками ниже.',
          this.mainInlineMenu(),
        );
      } else {
        await ctx.reply(`С возвращением, ${name}.`, this.mainInlineMenu());
      }
    });

    this.bot.action('menu:profile', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        username: actor.username,
        firstName: actor.first_name,
        lastName: actor.last_name,
        languageCode: actor.language_code,
      });
      await ctx.answerCbQuery();
      await this.sendOwnProfileCard(
        {
          userId: user.id,
          displayNameFallback: actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.action('menu:help', async (ctx) => {
      await ctx.answerCbQuery();
      await this.sendHelp(ctx.reply.bind(ctx));
    });

    this.bot.action('menu:feed', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        username: actor.username,
        firstName: actor.first_name,
        lastName: actor.last_name,
        languageCode: actor.language_code,
      });
      await ctx.answerCbQuery();
      await this.sendNextRealProfile(user.id, ctx.chat?.id, ctx.reply.bind(ctx));
    });

    this.bot.action(/^feed:(like|skip):(.+)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const action = ctx.match[1] as InteractionAction;
      const viewedId = String(ctx.match[2]);

      await this.interactionsService.react(user.id, viewedId, action);
      await ctx.answerCbQuery(action === 'like' ? 'Лайк' : 'Дизлайк');
      await this.sendNextRealProfile(user.id, ctx.chat?.id, ctx.reply.bind(ctx));
    });

    this.bot.action('menu:home', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Главное меню:', this.mainInlineMenu());
    });

    this.bot.action('profile:attach_photo', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({ telegramId: actor.id });
      this.waitingPhotoUpload.add(user.id);
      this.pendingProfileEditField.delete(user.id);
      await ctx.answerCbQuery();
      await ctx.reply('Пришли фото одним сообщением. Я прикреплю его к анкете.', this.mainInlineMenu());
    });

    this.bot.action('profile:edit', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        'Что изменить?',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✏️ Имя', 'profile:edit:displayName'),
            Markup.button.callback('📝 О себе', 'profile:edit:bio'),
          ],
          [
            Markup.button.callback('🏙️ Город', 'profile:edit:city'),
            Markup.button.callback('⬅️ Назад', 'profile:back'),
          ],
        ]),
      );
    });

    this.bot.action(/^profile:edit:(displayName|bio|city)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({ telegramId: actor.id });
      const field = ctx.match[1] as ProfileEditField;
      this.pendingProfileEditField.set(user.id, field);
      this.waitingPhotoUpload.delete(user.id);
      await ctx.answerCbQuery();
      const prompt =
        field === 'displayName'
          ? 'Пришли новое имя для анкеты.'
          : field === 'bio'
            ? 'Пришли новый текст "О себе".'
            : 'Пришли новый город.';
      await ctx.reply(prompt, this.mainInlineMenu());
    });

    this.bot.action('profile:back', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
        firstName: actor.first_name,
        username: actor.username,
      });
      this.pendingProfileEditField.delete(user.id);
      this.waitingPhotoUpload.delete(user.id);
      await ctx.answerCbQuery();
      await this.sendOwnProfileCard(
        {
          userId: user.id,
          displayNameFallback: actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.on('photo', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({ telegramId: actor.id });
      if (!this.waitingPhotoUpload.has(user.id)) {
        await ctx.reply('Открой профиль и нажми "Прикрепить фото".', this.mainInlineMenu());
        return;
      }

      const photos = (ctx.message as { photo?: Array<{ file_id: string }> }).photo ?? [];
      const largest = photos[photos.length - 1];
      if (!largest?.file_id) {
        await ctx.reply('Не удалось прочитать фото, попробуй еще раз.', this.mainInlineMenu());
        return;
      }
      const photoCount = await this.profilesService.addPhotoByTelegramFileId(user.id, largest.file_id);
      this.waitingPhotoUpload.delete(user.id);
      await ctx.reply(`Фото добавлено к анкете. Всего фото: ${photoCount}.`, this.mainInlineMenu());
      await this.sendOwnProfileCard(
        {
          userId: user.id,
          displayNameFallback: actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.on('text', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const text = ctx.message.text?.trim();
      if (!text || text.startsWith('/')) {
        await ctx.reply('Используй кнопки в сообщениях бота.', this.mainInlineMenu());
        return;
      }

      const { user } = await this.usersService.registerOrUpdateTelegramUser({ telegramId: actor.id });
      const pendingField = this.pendingProfileEditField.get(user.id);
      if (!pendingField) {
        await ctx.reply('Навигация только кнопками. Открой меню ниже.', this.mainInlineMenu());
        return;
      }

      await this.profilesService.updateField(user.id, pendingField, text);
      this.pendingProfileEditField.delete(user.id);
      await ctx.reply('Изменение сохранено.', this.mainInlineMenu());
      await this.sendOwnProfileCard(
        {
          userId: user.id,
          displayNameFallback: actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.on('message', async (ctx) => {
      if ('text' in ctx.message || 'photo' in ctx.message) {
        return;
      }
      await ctx.reply('Используй кнопки в меню.', this.mainInlineMenu());
    });

    await this.bot.launch();
    this.logger.log('telegram polling started');
  }

  async onModuleDestroy() {
    await this.bot.stop();
  }

  private mainInlineMenu() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('👤 Мой профиль', 'menu:profile')],
      [Markup.button.callback('🧩 Анкеты', 'menu:feed')],
      [Markup.button.callback('❓ Помощь', 'menu:help')],
    ]);
  }

  private async sendHelp(reply: (message: string, extra?: unknown) => Promise<unknown>) {
    await reply(
      [
        'Помощь:',
        '• Все управление только через inline-кнопки',
        '• 👤 Мой профиль - карточка профиля, фото и редактирование',
        '• 🧩 Анкеты - показать следующую анкету',
      ].join('\n'),
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'menu:home')]]),
    );
  }

  private async sendNextRealProfile(
    viewerId: string,
    chatId: number | undefined,
    reply: (message: string, extra?: unknown) => Promise<unknown>,
  ): Promise<void> {
    const candidate = await this.feedService.getNextProfile(viewerId);
    if (!candidate) {
      await reply(
        'Пока нет подходящих анкет в базе. Добавь реальные анкеты и попробуй снова.',
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'menu:home')]]),
      );
      return;
    }

    const caption = [
      'Кандидат:',
      `Имя: ${candidate.displayName}`,
      `Город: ${candidate.city || '-'}`,
      `О себе: ${candidate.bio || '-'}`,
      `Рейтинг: ${candidate.combinedScore.toFixed(2)}`,
    ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('❤️ Лайк', `feed:like:${candidate.userId}`),
        Markup.button.callback('👎 Дизлайк', `feed:skip:${candidate.userId}`),
      ],
      [Markup.button.callback('⬅️ В меню', 'menu:home')],
    ]);

    if (candidate.photoFileId && chatId) {
      await this.bot.telegram.sendPhoto(chatId, candidate.photoFileId, {
        caption,
        reply_markup: keyboard.reply_markup,
      });
      return;
    }

    await reply(caption, keyboard);
  }

  private async sendOwnProfileCard(
    input: { userId: string; displayNameFallback: string },
    reply: (message: string, extra?: unknown) => Promise<unknown>,
  ): Promise<void> {
    const profile = await this.profilesService.getOrCreateByUserId(input.userId, input.displayNameFallback);
    const photoCount = await this.profilesService.countPhotos(input.userId);
    await reply(
      [
        'Твоя анкета:',
        `Имя: ${profile.displayName || '-'}`,
        `О себе: ${profile.bio || '-'}`,
        `Город: ${profile.city || '-'}`,
        `Фото: ${photoCount}`,
        `Заполненность: ${profile.profileCompleteness}%`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('📷 Прикрепить фото', 'profile:attach_photo')],
        [Markup.button.callback('✏️ Изменить', 'profile:edit')],
        [Markup.button.callback('⬅️ В меню', 'menu:home')],
      ]),
    );
  }
}
