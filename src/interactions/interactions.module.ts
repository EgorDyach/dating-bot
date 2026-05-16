import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../database/entities/profile.entity';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MatchesModule } from '../matches/matches.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InteractionEntity, ProfileEntity]),
    IntegrationsModule,
    ProfilesModule,
    MatchesModule,
  ],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
