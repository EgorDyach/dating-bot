import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readEnv } from './config/env';
import { InteractionEntity } from './database/entities/interaction.entity';
import { ProfileEntity } from './database/entities/profile.entity';
import { ProfileRatingEntity } from './database/entities/profile-rating.entity';
import { UserPreferenceEntity } from './database/entities/user-preference.entity';
import { UserEntity } from './database/entities/user.entity';
import { FeedModule } from './feed/feed.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InteractionsModule } from './interactions/interactions.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

const env = readEnv();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: env.databaseUrl,
      entities: [UserEntity, ProfileEntity, UserPreferenceEntity, ProfileRatingEntity, InteractionEntity],
      synchronize: false,
      logging: false,
    }),
    IntegrationsModule,
    UsersModule,
    ProfilesModule,
    FeedModule,
    InteractionsModule,
    TelegramModule,
  ],
})
export class AppModule {}
