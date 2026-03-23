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

## Схема взаимодействия микросервисов

Логические сервисы и зоны ответственности — в [`01-services.md`](01-services.md). Ниже — как они связаны: **сплошные стрелки** — синхронные вызовы (HTTP/gRPC) от Bot Gateway к доменным сервисам и к хранилищам; **пунктир** — асинхронная публикация событий в брокер и обработка воркерами (пересчёт рейтингов, метрики, инвалидация кэша).

```mermaid
flowchart TB
  subgraph ext [External]
    TAPI[Telegram Bot API]
    MINIO[(MinIO)]
  end

  subgraph gw [Edge]
    BOT[Bot Gateway]
  end

  subgraph domain [Domain microservices]
    IDENT[Identity]
    PROF[Profile]
    FEED[Feed Matching]
    INTER[Interaction Events]
  end

  subgraph async [Async]
    MQ[(Message Broker)]
    WRK[Celery Workers]
  end

  subgraph data [Data]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end

  TAPI <--> BOT
  BOT --> IDENT
  BOT --> PROF
  BOT --> FEED
  BOT --> INTER
  PROF --> MINIO
  IDENT --> PG
  PROF --> PG
  FEED --> PG
  FEED --> RD
  INTER --> PG
  INTER -.-> MQ
  MQ -.-> WRK
  WRK --> PG
  WRK --> RD
```

Кратко по потокам:

| Направление | Что происходит |
|-------------|----------------|
| Bot Gateway → Identity | Регистрация/поиск пользователя по `telegram_id`, выдача внутреннего `user_id`. |
| Bot Gateway → Profile | CRUD анкеты, метаданные фото; загрузка файлов в MinIO (presigned URL или прокси). |
| Bot Gateway → Feed Matching | Следующая анкета, пачка ID в Redis, фильтры из `user_preferences`. |
| Bot Gateway → Interaction | Лайк/скип/мэтч, запись в БД, **публикация события** в брокер. |
| Broker → Celery | Обработка событий: поведенческий и комбинированный рейтинг, обновление `profile_ratings`, при необходимости правка кэша в Redis. |

На защите можно показать тот же рисунок и сказать, что сервисы допускается собрать в **один деплой** (модули монолита), но границы и потоки данных остаются такими же.

## Схема БД (связи таблиц)

Ниже — ER-диаграмма по [`schema.sql`](schema.sql): справочники, пользователь и анкета, лента/мэтчи/сообщения, рефералы. Составной ключ `profile_interests` связывает анкеты и теги интересов (M:N). Типы в Mermaid упрощены (`string`/`int`), чтобы диаграмма открывалась в GitHub; точные типы PostgreSQL — только в DDL.

```mermaid
erDiagram
  ref_genders {
    string code PK
    int sort_order
  }
  ref_interaction_actions {
    string code PK
  }
  users {
    int id PK
    int telegram_id
    string username
    string first_name
    string last_name
  }
  user_preferences {
    int user_id PK
    int age_min
    int age_max
    string gender_preference
    string city_preference
  }
  profiles {
    int id PK
    int user_id FK
    string display_name
    string gender_code FK
    string city
    int profile_completeness
  }
  interests {
    int id PK
    string slug
    string title
  }
  profile_interests {
    int profile_id FK
    int interest_id FK
  }
  profile_photos {
    int id PK
    int profile_id FK
    string storage_key
  }
  profile_ratings {
    int profile_id PK
    string primary_score
    string behavioral_score
    string combined_score
  }
  interactions {
    int id PK
    int viewer_id FK
    int viewed_id FK
    string action_code FK
  }
  matches {
    int id PK
    int user_low_id FK
    int user_high_id FK
  }
  messages {
    int id PK
    int match_id FK
    int sender_id FK
    string body
  }
  referrals {
    int id PK
    int referrer_id FK
    int referred_id FK
  }
  ref_genders ||--o{ profiles : gender_code
  users ||--|| profiles : one_profile
  users ||--|| user_preferences : filters
  users ||--o{ interactions : viewer
  users ||--o{ interactions : viewed
  ref_interaction_actions ||--o{ interactions : action_code
  users ||--o{ matches : user_low
  users ||--o{ matches : user_high
  matches ||--o{ messages : thread
  users ||--o{ messages : sender
  profiles ||--o{ profile_photos : photos
  profiles ||--|| profile_ratings : scores
  profiles ||--o{ profile_interests : m2m
  interests ||--o{ profile_interests : m2m
  users ||--o{ referrals : referrer
  users ||--o| referrals : referred
```

Кратко по кардинальности:

| Связь | Смысл |
|--------|--------|
| `users` ↔ `profiles` | 1:1 (один пользователь — одна анкета) |
| `users` ↔ `user_preferences` | 1:1 |
| `profiles` ↔ `ref_genders` | N:1 (пол из справочника, может быть не задан) |
| `profiles` ↔ `interests` | M:N через `profile_interests` |
| `users` ↔ `interactions` | два ребра: кто смотрит / кого смотрят; пара `(viewer, viewed)` уникальна |
| `users` ↔ `matches` | два ребра: `user_low_id` &lt; `user_high_id`, пара пользователей уникальна |
| `matches` ↔ `messages` | 1:N |
| `users` ↔ `referrals` | пригласивший 1:N к записям; у приглашённого не больше одной строки (`referred_id` UNIQUE) |

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

Схема данных: DDL в [`schema.sql`](schema.sql), связи — раздел «Схема БД» выше и `README.md`.
