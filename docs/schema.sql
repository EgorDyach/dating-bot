CREATE TABLE ref_genders (
    code        VARCHAR(16) PRIMARY KEY,
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_genders (code, sort_order) VALUES
    ('male', 1),
    ('female', 2);

CREATE TABLE ref_interaction_actions (
    code        VARCHAR(16) PRIMARY KEY
);

INSERT INTO ref_interaction_actions (code) VALUES
    ('like'),
    ('skip'),
    ('superlike');

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT NOT NULL UNIQUE,
    username        VARCHAR(32),
    first_name      VARCHAR(128) NOT NULL DEFAULT '',
    last_name       VARCHAR(128) NOT NULL DEFAULT '',
    language_code   VARCHAR(16),
    is_blocked      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_username_lowercase
        CHECK (username IS NULL OR username = lower(username))
);

CREATE INDEX idx_users_telegram_id ON users (telegram_id);

CREATE TABLE profiles (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    display_name        VARCHAR(64) NOT NULL,
    bio                 VARCHAR(2000) NOT NULL DEFAULT '',
    birth_date          DATE,
    gender_code         VARCHAR(16) REFERENCES ref_genders (code),
    city                VARCHAR(128) NOT NULL DEFAULT '',
    region              VARCHAR(128) NOT NULL DEFAULT '',
    country_code        VARCHAR(2) NOT NULL DEFAULT '',
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    profile_completeness SMALLINT NOT NULL DEFAULT 0
        CONSTRAINT ck_profiles_completeness CHECK (profile_completeness BETWEEN 0 AND 100),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_visible_in_feed  BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_profiles_coords
        CHECK (
            (latitude IS NULL AND longitude IS NULL)
            OR (
                latitude BETWEEN -90 AND 90
                AND longitude BETWEEN -180 AND 180
            )
        ),
    CONSTRAINT ck_profiles_birth_reasonable
        CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE)
);

CREATE INDEX idx_profiles_active_city
    ON profiles (city)
    WHERE is_active = true AND is_visible_in_feed = true;

CREATE INDEX idx_profiles_active_gender
    ON profiles (gender_code)
    WHERE is_active = true AND is_visible_in_feed = true;

CREATE INDEX idx_profiles_user ON profiles (user_id);

CREATE TABLE interests (
    id          SMALLSERIAL PRIMARY KEY,
    slug        VARCHAR(64) NOT NULL UNIQUE,
    title       VARCHAR(128) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE profile_interests (
    profile_id  BIGINT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    interest_id SMALLINT NOT NULL REFERENCES interests (id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, interest_id)
);

CREATE INDEX idx_profile_interests_interest ON profile_interests (interest_id);

CREATE TABLE user_preferences (
    user_id             BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    age_min             SMALLINT,
    age_max             SMALLINT,
    gender_preference   VARCHAR(16) NOT NULL DEFAULT 'any'
        CONSTRAINT ck_user_pref_gender_pref
            CHECK (gender_preference IN ('any', 'male', 'female')),
    city_preference     VARCHAR(128) NOT NULL DEFAULT '',
    max_distance_km     SMALLINT
        CONSTRAINT ck_user_pref_distance CHECK (max_distance_km IS NULL OR max_distance_km > 0),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_user_pref_age_order
        CHECK (
            age_min IS NULL
            OR age_max IS NULL
            OR age_min <= age_max
        ),
    CONSTRAINT ck_user_pref_age_nonnegative
        CHECK (
            (age_min IS NULL OR age_min >= 18)
            AND (age_max IS NULL OR age_max >= 18)
        )
);

CREATE TABLE profile_photos (
    id              BIGSERIAL PRIMARY KEY,
    profile_id      BIGINT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    storage_bucket  VARCHAR(64) NOT NULL DEFAULT 'profiles',
    storage_key     VARCHAR(512) NOT NULL,
    content_type    VARCHAR(128) NOT NULL DEFAULT 'image/jpeg',
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_profile_photos_key UNIQUE (storage_bucket, storage_key)
);

CREATE INDEX idx_profile_photos_profile ON profile_photos (profile_id, sort_order);

CREATE TABLE profile_ratings (
    profile_id          BIGINT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
    primary_score       NUMERIC(12, 6) NOT NULL DEFAULT 0,
    behavioral_score    NUMERIC(12, 6) NOT NULL DEFAULT 0,
    combined_score      NUMERIC(12, 6) NOT NULL DEFAULT 0,
    calc_version        BIGINT NOT NULL DEFAULT 1,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_ratings_combined ON profile_ratings (combined_score DESC);

CREATE TABLE interactions (
    id              BIGSERIAL PRIMARY KEY,
    viewer_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    viewed_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    action_code     VARCHAR(16) NOT NULL REFERENCES ref_interaction_actions (code),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_interactions_distinct_users CHECK (viewer_id <> viewed_id),
    CONSTRAINT uq_interactions_pair UNIQUE (viewer_id, viewed_id)
);

CREATE INDEX idx_interactions_viewer_created ON interactions (viewer_id, created_at DESC);
CREATE INDEX idx_interactions_viewed ON interactions (viewed_id);
CREATE INDEX idx_interactions_action ON interactions (action_code);

CREATE TABLE matches (
    id              BIGSERIAL PRIMARY KEY,
    user_low_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_high_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_matches_order CHECK (user_low_id < user_high_id),
    CONSTRAINT uq_matches_pair UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX idx_matches_user_low ON matches (user_low_id);
CREATE INDEX idx_matches_user_high ON matches (user_high_id);

CREATE TABLE messages (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body            VARCHAR(4096) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_match_created ON messages (match_id, created_at);

CREATE TABLE referrals (
    id              BIGSERIAL PRIMARY KEY,
    referrer_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    referred_id     BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    referral_code   VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_referrals_no_self CHECK (referrer_id <> referred_id)
);

CREATE INDEX idx_referrals_referrer ON referrals (referrer_id);
