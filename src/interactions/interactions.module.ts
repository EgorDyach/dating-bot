import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([InteractionEntity]), IntegrationsModule],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
