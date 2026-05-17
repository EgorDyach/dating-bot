import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/feed.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TelegramService } from '../integrations/telegram.service';
import { InteractionsModule } from '../interactions/interactions.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { BlocksModule } from '../blocks/blocks.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [
    UsersModule,
    ProfilesModule,
    FeedModule,
    InteractionsModule,
    IntegrationsModule,
    BlocksModule,
    ReportsModule,
    AnalyticsModule,
    MatchesModule,
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
