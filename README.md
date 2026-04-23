# Dating Bot — NestJS + TypeORM + PostgreSQL

Учебный проект dating-приложения с Telegram-интерфейсом.  
Текущая реализация полностью переведена на `NestJS`, `TypeORM` и `PostgreSQL`, без Python-бота и без raw SQL в прикладной логике.

## Статус этапов

| Этап | Содержание | Статус |
|------|------------|--------|
| 1 | Планирование: сервисы, архитектура, схема БД | Выполнено |
| 2 | Базовая функциональность `/start` и регистрация | Выполнено (перенесено в Nest) |
| 3 | Анкеты, ранжирование, Redis, RabbitMQ, интеграция с ботом | Выполнено |
| 4 | Фоновые воркеры, тесты, деплой | Планируется |

## Что реализовано в этапе 3

- Telegram polling на `telegraf`, управляется через Nest lifecycle.
- Регистрация и обновление пользователя в `users` через `TypeORM`.
- CRUD-lite анкеты через команду `/profile`.
- Лента `/feed` с кешированием батчей кандидатов в `Redis`.
- Ранжирование выдачи на основе `profile_ratings.combined_score`.
- Запись реакций (`/like`, `/skip`) в `interactions` и публикация события в `RabbitMQ`.
- Все обращения к БД через репозитории/QueryBuilder TypeORM.

## Команды бота

- `/start` - регистрация или обновление пользователя из Telegram.
- `/help` - список команд.
- `/profile Имя|Город|О себе` - создать или обновить анкету.
- `/feed` - получить следующую анкету.
- `/like` - лайк последней показанной анкеты.
- `/skip` - пропуск последней показанной анкеты.

## Быстрый старт

1. Создай бота у [@BotFather](https://t.me/BotFather), получи токен.
2. Подними инфраструктуру:

   ```bash
   docker compose up -d
   ```

3. Подготовь окружение и зависимости:

   ```bash
   cp .env.example .env
   npm install
   ```

4. Запусти backend:

   ```bash
   npm run start:dev
   ```

По умолчанию сервисы:

- PostgreSQL: `localhost:5422`
- Redis: `localhost:6379`
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ UI: [http://localhost:15672](http://localhost:15672)

## Переменные окружения

См. `.env.example`:

- `BOT_TOKEN` - токен Telegram-бота.
- `DATABASE_URL` - строка подключения PostgreSQL.
- `REDIS_URL` - подключение к Redis.
- `RABBITMQ_URL` - подключение к RabbitMQ.
- `RABBITMQ_EXCHANGE` - exchange для событий взаимодействий.

## Артефакты этапа 1

- [Описание сервисов](docs/01-services.md)
- [Архитектура и диаграммы](docs/02-architecture.md)
- [DDL схемы PostgreSQL](docs/schema.sql)
