# Dating Bot — NestJS + TypeORM + PostgreSQL

Полнофункциональное dating-приложение с Telegram-интерфейсом. Реализована трёхуровневая система рейтинга профилей, фоновая обработка задач, логирование и мониторинг.

## Статус этапов

| Этап | Содержание | Статус |
|------|------------|--------|
| 1 | Планирование: сервисы, архитектура, схема БД | ✅ Выполнено |
| 2 | Базовая функциональность `/start` и регистрация | ✅ Выполнено |
| 3 | Анкеты, ранжирование, Redis, RabbitMQ, интеграция | ✅ Выполнено |
| 4 | Фоновые воркеры, тесты, логирование, метрики | ✅ Выполнено |

## Ключевые возможности

### Рейтинговая система (3 уровня)
- **Уровень 1 (Первичный рейтинг)**: основан на полноте профиля, наличии фотографий и статусе активности
- **Уровень 2 (Поведенческий рейтинг)**: учитывает количество лайков, соотношение лайков/пропусков и взаимные лайки (мэтчи)
- **Уровень 3 (Комбинированный рейтинг)**: интегрирует первичный и поведенческий рейтинги с весовой моделью

### Кэширование и производительность
- **Redis кэширование**: батчи профилей (10 шт) предзагружаются в Redis при начале сессии
- **Оптимизированная выдача**: ранжирование на основе combined_score + полнота профиля
- **Фильтрация**: поддержка фильтров по городу и полу в соответствии с предпочтениями пользователя

### Фоновая обработка (Bull Queue - NestJS эквивалент Celery)
- **Периодический пересчет рейтингов**: работает каждый час (cron job)
- **Обработка взаимодействий**: немедленный пересчет рейтинга профиля после лайка/пропуска
- **Надёжность**: retry с экспоненциальной задержкой для отказоустойчивости

### Логирование и мониторинг
- **Пром-клиент (Prometheus)**: метрики для мониторинга
  - Счётчики: общее количество лайков, пропусков, супер-лайков
  - Гистограммы: время генерации батчей фидов, время пересчета рейтингов
  - Gauge: текущий score профилей
- **RabbitMQ**: публикация событий взаимодействия для асинхронной обработки

### Система матчей и сообщений
- **Автоматическое создание матчей**: при обнаружении взаимных лайков
- **Сообщения**: отправка и получение сообщений между матчед пользователями
- **История сообщений**: сохранение всей переписки в БД

### Тестирование
- **Unit тесты**: 21 тест для всех ключевых сервисов
- **Покрытие**: RatingCalculationService, FeedService, InteractionsService, MatchesService, MessagesService
- **Jest + NestJS Testing**: полная настройка для TDD

## Команды бота

- `/start` - регистрация или обновление пользователя из Telegram
- `/help` - список всех команд
- `/profile Имя|Город|О себе` - создать или обновить анкету
- `/feed` - получить следующую анкету из ленты
- `/like` - отправить лайк последней показанной анкете
- `/skip` - пропустить последнюю анкету
- `/superlike` - отправить супер-лайк (вес 5x от обычного лайка)

## Быстрый старт

### Предварительные требования
- Node.js 18+
- Docker & Docker Compose
- Telegram бот (создайте у [@BotFather](https://t.me/BotFather))

### Установка

1. Клонируйте репозиторий и установите зависимости:
   ```bash
   npm install
   ```

2. Поднимите инфраструктуру (PostgreSQL, Redis, RabbitMQ):
   ```bash
   docker compose up -d
   ```

3. Подготовьте переменные окружения:
   ```bash
   cp .env.example .env
   # Отредактируйте .env и добавьте BOT_TOKEN
   ```

4. Запустите приложение:
   ```bash
   npm run start:dev
   ```

5. Запустите тесты:
   ```bash
   npm test
   npm test:cov  # с отчетом покрытия
   ```

### Сервисы по умолчанию

| Сервис | URL | Описание |
|--------|-----|---------|
| PostgreSQL | `localhost:5422` | База данных |
| Redis | `localhost:6379` | Кэш + очередь заданий |
| RabbitMQ AMQP | `localhost:5672` | Message broker для событий |
| RabbitMQ UI | [http://localhost:15672](http://localhost:15672) | Мониторинг RabbitMQ (guest/guest) |
| Prometheus Metrics | [http://localhost:3000/metrics](http://localhost:3000/metrics) | Метрики приложения |

## Переменные окружения

Необходимые переменные (см. `.env.example`):

```env
BOT_TOKEN=<ваш_токен_бота>
DATABASE_URL=postgresql://postgres:postgres@localhost:5422/dating_bot
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=dating_events
```

## Архитектура

### Слои приложения

```
telegram/           → Управление Telegram ботом (polling)
    ├── telegram.service.ts
    └── telegram.module.ts

users/              → Управление пользователями и их предпочтениями
    ├── users.service.ts
    └── users.module.ts

profiles/           → CRUD профилей, система рейтинга, фоновые работы
    ├── profiles.service.ts
    ├── rating-calculation.service.ts    → 3-уровневый алгоритм рейтинга
    ├── rating-queue.service.ts          → Bull очередь для пересчета
    ├── rating.processor.ts              → Обработчик фоновых задач
    └── profiles.module.ts

feed/               → Лента профилей с кэшированием
    ├── feed.service.ts
    └── feed.module.ts

interactions/       → Регистрация лайков, пропусков, создание матчей
    ├── interactions.service.ts
    └── interactions.module.ts

matches/            → Управление матчами и сообщениями
    ├── matches.service.ts
    ├── messages.service.ts
    └── matches.module.ts

integrations/       → Внешние сервисы
    ├── redis.service.ts
    ├── rabbitmq.service.ts
    ├── metrics.service.ts               → Prometheus метрики
    └── integrations.module.ts

database/           → TypeORM entities
    └── entities/
        ├── user.entity.ts
        ├── profile.entity.ts
        ├── profile-rating.entity.ts
        ├── interaction.entity.ts
        ├── match.entity.ts
        ├── message.entity.ts
        ├── profile-photo.entity.ts
        ├── user-preference.entity.ts
        └── ...
```

### Поток данных: Лайк профиля

```
Telegram (/like)
    ↓
TelegramService.onLike()
    ↓
InteractionsService.react()
    ├── Сохранение в interactions table
    ├── Пересчет рейтинга профиля (RatingCalculationService)
    ├── Проверка на взаимный лайк → Создание Match
    ├── Запись метрик (likes_total++)
    ├── Очистка Redis кэша (clearFeed)
    └── Публикация события в RabbitMQ
    
RatingProcessor (Bull Queue)
    ├── Периодически (каждый час) пересчитывает все рейтинги
    └── Записывает метрики производительности
```

## Документация и артефакты

- [Описание сервисов](docs/01-services.md)
- [Архитектура и диаграммы](docs/02-architecture.md)
- [Схема БД PostgreSQL](docs/schema.sql)

## Разработка

### Запуск в режиме watch
```bash
npm run start:dev
```

### Запуск тестов
```bash
npm test                  # однократный запуск
npm run test:watch       # watch режим
npm run test:cov         # с отчетом покрытия
```

### Сборка для production
```bash
npm run build
npm run start:prod
```

## Метрики и мониторинг

Доступные метрики по адресу `/metrics` в формате Prometheus:

- `profiles_viewed_total` - общее количество просмотров профилей
- `likes_total` - всего отправлено лайков
- `skips_total` - всего пропущено профилей
- `superlikes_total` - всего супер-лайков
- `feed_batch_duration_ms` - время генерации батчей (гистограмма)
- `rating_recalculation_duration_ms` - время пересчета рейтингов (гистограмма)
- `profile_rating_score` - текущий score каждого профиля

## Тестирование

Проект использует Jest с NestJS Testing Module:

```bash
# Запуск всех тестов
npm test

# Watch режим для TDD
npm run test:watch

# Отчет покрытия
npm run test:cov
```

**Покрытие**: 21 unit тест для всех критических сервисов
