import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserPreferenceEntity } from '../database/entities/user-preference.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { FeedService } from './feed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileEntity, ProfileRatingEntity, UserPreferenceEntity, InteractionEntity]),
    IntegrationsModule,
  ],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
