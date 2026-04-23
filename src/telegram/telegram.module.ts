import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/feed.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TelegramService } from '../integrations/telegram.service';
import { InteractionsModule } from '../interactions/interactions.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, ProfilesModule, FeedModule, InteractionsModule, IntegrationsModule],
  providers: [TelegramService],
})
export class TelegramModule {}
