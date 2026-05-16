import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { readEnv } from './config/env';
import { InteractionEntity } from './database/entities/interaction.entity';
import { MatchEntity } from './database/entities/match.entity';
import { MessageEntity } from './database/entities/message.entity';
import { ProfileEntity } from './database/entities/profile.entity';
import { ProfilePhotoEntity } from './database/entities/profile-photo.entity';
import { ProfileRatingEntity } from './database/entities/profile-rating.entity';
import { UserPreferenceEntity } from './database/entities/user-preference.entity';
import { UserEntity } from './database/entities/user.entity';
import { BlockEntity } from './database/entities/block.entity';
import { ReportEntity } from './database/entities/report.entity';
import { FeedModule } from './feed/feed.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InteractionsModule } from './interactions/interactions.module';
import { MatchesModule } from './matches/matches.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';
import { BlocksModule } from './blocks/blocks.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';

const env = readEnv();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: env.databaseUrl,
      entities: [
        UserEntity,
        ProfileEntity,
        UserPreferenceEntity,
        ProfilePhotoEntity,
        ProfileRatingEntity,
        InteractionEntity,
        MatchEntity,
        MessageEntity,
        BlockEntity,
        ReportEntity,
      ],
      synchronize: false,
      logging: false,
    }),
    BullModule.forRoot({
      redis: env.redisUrl,
    }),
    ScheduleModule.forRoot(),
    IntegrationsModule,
    UsersModule,
    ProfilesModule,
    FeedModule,
    InteractionsModule,
    MatchesModule,
    BlocksModule,
    ReportsModule,
    AnalyticsModule,
    TelegramModule,
  ],
})
export class AppModule {}
