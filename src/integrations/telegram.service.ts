import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { readEnv } from '../config/env';
import { FeedService } from '../feed/feed.service';
import {
  InteractionAction,
  InteractionsService,
} from '../interactions/interactions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';
import { UserPreferencesService } from '../users/user-preferences.service';
import { BlocksService } from '../blocks/blocks.service';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';

type ProfileEditField = 'displayName' | 'bio' | 'city' | 'birthDate' | 'genderCode';
type PrefEditField = 'genderPreference' | 'cityPreference' | 'ageMin' | 'ageMax';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Telegraf;
  private readonly pendingProfileEditField = new Map<
    string,
    ProfileEditField
  >();
  private readonly pendingPrefEditField = new Map<string, PrefEditField>();
  private readonly pendingReport = new Map<string, string>();
  private readonly waitingPhotoUpload = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly profilesService: ProfilesService,
    private readonly feedService: FeedService,
    private readonly interactionsService: InteractionsService,
    private readonly blocksService: BlocksService,
    private readonly reportsService: ReportsService,
    private readonly analyticsService: AnalyticsService,
  ) {
    const env = readEnv();
    const botOptions = this.createBotOptions(env);
    this.bot = new Telegraf(env.botToken, botOptions);
  }

  private createBotOptions(env: ReturnType<typeof readEnv>) {
    if (!env.proxyServer || !env.proxyPort) {
      return {};
    }

    try {
      const { HttpProxyAgent } = require('http-proxy-agent');
      const { HttpsProxyAgent } = require('https-proxy-agent');

      const proxyUrl = `http://${env.proxyServer}:${env.proxyPort}`;
      const agent = new HttpsProxyAgent(proxyUrl);

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
    await this.bot.telegram.setMyCommands([]);

    this.bot.start(async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { isNew, user } =
        await this.usersService.registerOrUpdateTelegramUser({
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
          displayNameFallback:
            actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.action('menu:help', async (ctx) => {
      await ctx.answerCbQuery();
      await this.sendHelp(ctx.reply.bind(ctx));
    });

    this.bot.action('menu:preferences', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      await ctx.answerCbQuery();
      await this.sendPreferencesMenu(ctx.reply.bind(ctx));
    });

    this.bot.action('menu:stats', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      await ctx.answerCbQuery();
      const stats = await this.analyticsService.getUserStats(user.id);
      const message =
        '📊 Твоя статистика:\n' +
        `👁️ Просмотров профиля: ${stats.profileViewsCount}\n` +
        `❤️ Лайков получено: ${stats.likesReceived}\n` +
        `💑 Совпадений: ${stats.matchesCount}\n` +
        `⭐ Рейтинг: ${stats.currentRating.toFixed(2)}\n` +
        `👍 Ты лайкнул: ${stats.likesGiven}\n` +
        `👎 Ты пропустил: ${stats.skipsGiven}`;
      await ctx.reply(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ В меню', 'menu:home')],
        ]),
      );
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
      await this.sendNextRealProfile(
        user.id,
        ctx.chat?.id,
        ctx.reply.bind(ctx),
      );
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
      await this.sendNextRealProfile(
        user.id,
        ctx.chat?.id,
        ctx.reply.bind(ctx),
      );
    });

    this.bot.action(/^user:block:(.+)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const blockedId = String(ctx.match[1]);
      await this.blocksService.blockUser(user.id, blockedId);
      await ctx.answerCbQuery('Пользователь заблокирован');
      await this.sendNextRealProfile(
        user.id,
        ctx.chat?.id,
        ctx.reply.bind(ctx),
      );
    });

    this.bot.action(/^user:report:(.+)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const reportedId = String(ctx.match[1]);
      this.pendingReport.set(user.id, reportedId);
      await ctx.answerCbQuery();
      await ctx.reply(
        'Выбери причину жалобы:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🚨 Спам', 'report:reason:spam'),
            Markup.button.callback('🔞 Неприличный контент', 'report:reason:inappropriate'),
          ],
          [
            Markup.button.callback('🎭 Фейк', 'report:reason:fake'),
            Markup.button.callback('❌ Отмена', 'report:cancel'),
          ],
        ]),
      );
    });

    this.bot.action(/^report:reason:(spam|inappropriate|fake)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const reason = ctx.match[1];
      const reportedId = this.pendingReport.get(user.id);
      if (!reportedId) {
        await ctx.answerCbQuery('Ошибка');
        return;
      }
      await this.reportsService.reportUser(user.id, reportedId, reason);
      this.pendingReport.delete(user.id);
      await ctx.answerCbQuery('Жалоба отправлена');
      await this.sendNextRealProfile(
        user.id,
        ctx.chat?.id,
        ctx.reply.bind(ctx),
      );
    });

    this.bot.action('report:cancel', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      this.pendingReport.delete(user.id);
      await ctx.answerCbQuery();
      await ctx.reply('Главное меню:', this.mainInlineMenu());
    });

    this.bot.action(/^gender:select:(male|female)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const gender = ctx.match[1];
      try {
        await this.profilesService.updateField(user.id, 'genderCode', gender);
        this.pendingProfileEditField.delete(user.id);
        await ctx.answerCbQuery('Пол сохранен');
        await this.sendOwnProfileCard(
          {
            userId: user.id,
            displayNameFallback:
              actor.first_name || actor.username || 'Пользователь',
          },
          ctx.reply.bind(ctx),
        );
      } catch (err) {
        await ctx.answerCbQuery(`Ошибка: ${err.message}`);
      }
    });

    this.bot.action(/^genderPref:select:(male|female|any)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const genderPref = ctx.match[1];
      try {
        await this.userPreferencesService.updatePreference(user.id, 'genderPreference', genderPref);
        this.pendingPrefEditField.delete(user.id);
        await ctx.answerCbQuery('Фильтр сохранен');
        await this.sendPreferencesMenu(ctx.reply.bind(ctx));
      } catch (err) {
        await ctx.answerCbQuery(`Ошибка: ${err.message}`);
      }
    });

    this.bot.action('menu:home', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Главное меню:', this.mainInlineMenu());
    });

    this.bot.action('profile:attach_photo', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      this.waitingPhotoUpload.add(user.id);
      this.pendingProfileEditField.delete(user.id);
      await ctx.answerCbQuery();
      await ctx.reply(
        'Пришли фото одним сообщением. Я прикреплю его к анкете.',
        Markup.inlineKeyboard([[Markup.button.callback('🚫 Отмена', 'profile:back')]]),
      );
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
            Markup.button.callback('🎂 Дата рождения', 'profile:edit:birthDate'),
          ],
          [
            Markup.button.callback('⚧ Пол', 'profile:edit:genderCode'),
            Markup.button.callback('⬅️ Назад', 'profile:back'),
          ],
        ]),
      );
    });

    this.bot.action(/^profile:edit:(displayName|bio|city|birthDate|genderCode)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const field = ctx.match[1] as ProfileEditField;
      this.pendingProfileEditField.set(user.id, field);
      this.waitingPhotoUpload.delete(user.id);
      this.pendingPrefEditField.delete(user.id);
      await ctx.answerCbQuery();

      if (field === 'genderCode') {
        await ctx.reply(
          'Выбери пол:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('👨 Мужчина', 'gender:select:male'),
              Markup.button.callback('👩 Женщина', 'gender:select:female'),
            ],
            [Markup.button.callback('🚫 Отмена', 'profile:back')],
          ]),
        );
      } else {
        const prompt =
          field === 'displayName'
            ? 'Пришли новое имя для анкеты.'
            : field === 'bio'
              ? 'Пришли новый текст "О себе".'
              : field === 'city'
                ? 'Пришли новый город.'
                : 'Пришли дату рождения в формате ДД.ММ.ГГГГ (например, 01.01.2000).';
        await ctx.reply(
          prompt,
          Markup.inlineKeyboard([[Markup.button.callback('🚫 Отмена', 'profile:back')]]),
        );
      }
    });

    this.bot.action(/^prefs:edit:(genderPreference|cityPreference|ageMin|ageMax)$/, async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      const field = ctx.match[1] as PrefEditField;
      this.pendingPrefEditField.set(user.id, field);
      this.pendingProfileEditField.delete(user.id);
      this.waitingPhotoUpload.delete(user.id);
      await ctx.answerCbQuery();

      if (field === 'genderPreference') {
        await ctx.reply(
          'Выбери предпочтение по полу:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('👨 Мужчины', 'genderPref:select:male'),
              Markup.button.callback('👩 Женщины', 'genderPref:select:female'),
            ],
            [
              Markup.button.callback('🔄 Любой', 'genderPref:select:any'),
              Markup.button.callback('🚫 Отмена', 'prefs:cancel'),
            ],
          ]),
        );
      } else {
        const prompt =
          field === 'cityPreference'
            ? 'Укажи город.'
            : field === 'ageMin'
              ? 'Укажи минимальный возраст (18+).'
              : 'Укажи максимальный возраст.';
        await ctx.reply(
          prompt,
          Markup.inlineKeyboard([[Markup.button.callback('🚫 Отмена', 'prefs:cancel')]]),
        );
      }
    });

    this.bot.action('prefs:cancel', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      this.pendingPrefEditField.delete(user.id);
      await ctx.answerCbQuery();
      await this.sendPreferencesMenu(ctx.reply.bind(ctx));
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
          displayNameFallback:
            actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.on('photo', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });
      if (!this.waitingPhotoUpload.has(user.id)) {
        await ctx.reply(
          'Открой профиль и нажми "Прикрепить фото".',
          this.mainInlineMenu(),
        );
        return;
      }

      const photos =
        (ctx.message as { photo?: Array<{ file_id: string }> }).photo ?? [];
      const largest = photos[photos.length - 1];
      if (!largest?.file_id) {
        await ctx.reply(
          'Не удалось прочитать фото, попробуй еще раз.',
          this.mainInlineMenu(),
        );
        return;
      }
      const photoCount = await this.profilesService.addPhotoByTelegramFileId(
        user.id,
        largest.file_id,
      );
      this.waitingPhotoUpload.delete(user.id);
      await ctx.reply(
        `Фото добавлено к анкете. Всего фото: ${photoCount}.`,
        this.mainInlineMenu(),
      );
      await this.sendOwnProfileCard(
        {
          userId: user.id,
          displayNameFallback:
            actor.first_name || actor.username || 'Пользователь',
        },
        ctx.reply.bind(ctx),
      );
    });

    this.bot.on('text', async (ctx) => {
      const actor = ctx.from;
      if (!actor) return;
      const text = ctx.message.text?.trim();
      if (!text || text.startsWith('/')) {
        await ctx.reply(
          'Используй кнопки в сообщениях бота.',
          this.mainInlineMenu(),
        );
        return;
      }

      const { user } = await this.usersService.registerOrUpdateTelegramUser({
        telegramId: actor.id,
      });

      // Check preference field first
      const pendingPref = this.pendingPrefEditField.get(user.id);
      if (pendingPref) {
        try {
          await this.userPreferencesService.updatePreference(user.id, pendingPref, text);
          this.pendingPrefEditField.delete(user.id);
          await ctx.reply('Фильтр сохранен.');
          await this.sendPreferencesMenu(ctx.reply.bind(ctx));
          return;
        } catch (err) {
          await ctx.reply(`Ошибка: ${err.message}`);
          return;
        }
      }

      // Check profile field
      const pendingField = this.pendingProfileEditField.get(user.id);
      if (!pendingField) {
        await ctx.reply(
          'Навигация только кнопками. Открой меню ниже.',
          this.mainInlineMenu(),
        );
        return;
      }

      try {
        let valueToSave = text;
        if (pendingField === 'birthDate') {
          const dateMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (!dateMatch) {
            await ctx.reply('Неверный формат. Пришли дату в формате ДД.ММ.ГГГГ (например, 01.01.2000).');
            return;
          }
          const [, day, month, year] = dateMatch;
          valueToSave = `${year}-${month}-${day}`;
        }
        await this.profilesService.updateField(user.id, pendingField, valueToSave);
        this.pendingProfileEditField.delete(user.id);
        await ctx.reply('Изменение сохранено.', this.mainInlineMenu());
        await this.sendOwnProfileCard(
          {
            userId: user.id,
            displayNameFallback:
              actor.first_name || actor.username || 'Пользователь',
          },
          ctx.reply.bind(ctx),
        );
      } catch (err) {
        await ctx.reply(`Ошибка: ${err.message}`);
      }
    });

    this.bot.on('message', async (ctx) => {
      if ('text' in ctx.message || 'photo' in ctx.message) {
        return;
      }
      await ctx.reply('Используй кнопки в меню.', this.mainInlineMenu());
    });

    await this.bot.launch();
    this.logger.log('Telegram бот запущен');
  }

  async onModuleDestroy() {
    await this.bot.stop();
  }

  private mainInlineMenu() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('👤 Мой профиль', 'menu:profile')],
      [Markup.button.callback('🧩 Анкеты', 'menu:feed')],
      [Markup.button.callback('🔍 Фильтры', 'menu:preferences')],
      [Markup.button.callback('📊 Статистика', 'menu:stats')],
      [Markup.button.callback('❓ Помощь', 'menu:help')],
    ]);
  }

  private async sendHelp(
    reply: (message: string, extra?: unknown) => Promise<unknown>,
  ) {
    await reply(
      [
        'Помощь:',
        '• Все управление только через inline-кнопки',
        '• 👤 Мой профиль - карточка профиля, фото и редактирование',
        '• 🧩 Анкеты - показать следующую анкету',
        '• 🔍 Фильтры - настройка фильтров для ленты',
        '• 📊 Статистика - твоя активность',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ В меню', 'menu:home')],
      ]),
    );
  }

  private async sendPreferencesMenu(
    reply: (message: string, extra?: unknown) => Promise<unknown>,
  ) {
    await reply(
      'Фильтры профилей:',
      Markup.inlineKeyboard([
        [Markup.button.callback('⚧ Пол', 'prefs:edit:genderPreference')],
        [Markup.button.callback('🏙️ Город', 'prefs:edit:cityPreference')],
        [
          Markup.button.callback('📅 Мин. возраст', 'prefs:edit:ageMin'),
          Markup.button.callback('📅 Макс. возраст', 'prefs:edit:ageMax'),
        ],
        [Markup.button.callback('⬅️ В меню', 'menu:home')],
      ]),
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
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ В меню', 'menu:home')],
        ]),
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
      [
        Markup.button.callback('🚫 Блок', `user:block:${candidate.userId}`),
        Markup.button.callback('⚠️ Жалоба', `user:report:${candidate.userId}`),
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
    const profile = await this.profilesService.getOrCreateByUserId(
      input.userId,
      input.displayNameFallback,
    );
    const photoCount = await this.profilesService.countPhotos(input.userId);
    await reply(
      [
        'Твоя анкета:',
        `Имя: ${profile.displayName || '-'}`,
        `О себе: ${profile.bio || '-'}`,
        `Город: ${profile.city || '-'}`,
        `Дата рождения: ${profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('ru-RU') : '-'}`,
        `Пол: ${profile.genderCode || '-'}`,
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
