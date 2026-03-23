-- Схема БД: Dating Bot (черновик для этапа проектирования)
-- СУБД: PostgreSQL (рекомендуется)

-- Расширения (при необходимости на этапе реализации)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Пользователь = связка с Telegram
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT NOT NULL UNIQUE,
    username        TEXT,
    first_name      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Анкета (1:1 с users в базовом варианте)
CREATE TABLE profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    display_name    TEXT,
    bio             TEXT,
    birth_date      DATE,
    gender          TEXT,           -- или ENUM на этапе реализации
    city            TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    interests       TEXT[],         -- или отдельная таблица interests при нормализации
    profile_completeness SMALLINT NOT NULL DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Предпочтения поиска (возраст, пол, город)
CREATE TABLE user_preferences (
    user_id         BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    age_min         SMALLINT,
    age_max         SMALLINT,
    gender_preference TEXT,         -- 'any', 'male', 'female', ...
    city_preference TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Фото анкеты (метаданные; файлы в S3/MinIO)
CREATE TABLE profile_photos (
    id              BIGSERIAL PRIMARY KEY,
    profile_id      BIGINT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    storage_key     TEXT NOT NULL,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Агрегированные рейтинги (отдельная зона ответственности — пересчёт Celery)
CREATE TABLE profile_ratings (
    profile_id      BIGINT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
    primary_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
    behavioral_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    combined_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
    version           BIGINT NOT NULL DEFAULT 1,
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Взаимодействия: кто кого как обработал (уникальная пара viewer -> viewed)
CREATE TABLE interactions (
    id              BIGSERIAL PRIMARY KEY,
    viewer_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    viewed_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    action          TEXT NOT NULL CHECK (action IN ('like', 'skip', 'superlike')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (viewer_id, viewed_id)
);

-- Мэтчи
CREATE TABLE matches (
    id              BIGSERIAL PRIMARY KEY,
    user_a_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_a_id < user_b_id),
    UNIQUE (user_a_id, user_b_id)
);

-- Сообщения после мэтча (если храним в БД; иначе таблица опциональна)
CREATE TABLE messages (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Рефералы (доп. фактор для комбинированного рейтинга)
CREATE TABLE referrals (
    id              BIGSERIAL PRIMARY KEY,
    referrer_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    referred_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (referred_id)
);

-- Индексы под выдачу и аналитику
CREATE INDEX idx_profiles_city ON profiles (city) WHERE is_active = true;
CREATE INDEX idx_profiles_gender ON profiles (gender) WHERE is_active = true;
CREATE INDEX idx_interactions_viewer ON interactions (viewer_id, created_at DESC);
CREATE INDEX idx_interactions_viewed ON interactions (viewed_id);
CREATE INDEX idx_profile_ratings_combined ON profile_ratings (combined_score DESC);

COMMENT ON TABLE profile_ratings IS 'Кэш пересчитанных рейтингов; обновление воркерами Celery';
COMMENT ON TABLE interactions IS 'События лайк/скип; также могут дублироваться в очередь для стриминга';
