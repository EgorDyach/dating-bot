# Архитектура и схема системы

## Общая идея

Клиент — только Telegram. Backend обрабатывает команды, читает и пишет данные в PostgreSQL, кэширует выдачу в Redis, кладёт события взаимодействий в очередь для асинхронной обработки, хранит файлы в S3-совместимом хранилище. Воркеры Celery пересчитывают рейтинги и обновляют кэш по политике приложения.

## Диаграмма контекста (C4: System Context)

```mermaid
flowchart LR
  TG[Telegram User]
  TAPI[Telegram Bot API]
  SYS[Dating Bot Platform]

  TG <--> TAPI
  TAPI <--> SYS
```

## Диаграмма контейнеров (логические компоненты)

```mermaid
flowchart TB
  subgraph external [Внешние системы]
    Telegram[Telegram Bot API]
    MinIO[(MinIO / S3)]
  end

  subgraph platform [Платформа]
    Bot[Bot Gateway]
    API[Core API]
    Worker[Celery Workers]
    Broker[(Message Broker\nKafka / RabbitMQ)]
  end

  subgraph data [Данные]
    PG[(PostgreSQL)]
    Redis[(Redis)]
  end

  Telegram <--> Bot
  Bot --> API
  API --> PG
  API --> Redis
  API --> MinIO
  API --> Broker
  Broker --> Worker
  Worker --> PG
  Worker --> Redis
```

## Поток: сессия и «пачка» из 10 анкет

1. Пользователь открывает ленту; Bot вызывает API «дать следующую анкету».
2. API проверяет Redis: есть ли готовая очередь ID профилей для этого пользователя.
3. Если очередь пуста или заканчивается — Matching/Rating формирует новую порцию (например, 10 ID), ранжирует, кладёт в Redis; первую отдаёт в ответ.
4. События «показ», «лайк», «скип» публикуются в брокер; воркеры обновляют поведенческий рейтинг и при необходимости инвалидируют/дополняют кэш.

```mermaid
sequenceDiagram
  participant U as User
  participant B as Bot
  participant API as Core API
  participant R as Redis
  participant Q as Message Broker

  U->>B: Лента / следующая анкета
  B->>API: GET next profile
  API->>R: get feed batch
  alt batch missing or last item
    API->>API: rank + build batch (10)
    API->>R: store batch
  end
  API-->>B: profile + media URLs
  B-->>U: карточка
  U->>B: like / skip
  B->>API: POST interaction
  API->>Q: event
```

## Развёртывание (ориентир)

- Один или несколько инстансов API + Bot (или Bot как отдельный процесс, вызывающий тот же API).
- Воркеры Celery горизонтально масштабируются; брокер и Redis/PostgreSQL — отказоустойчивые конфигурации по мере необходимости.

---

Схема данных — в `schema.sql` и кратком описании внизу `README.md`.
