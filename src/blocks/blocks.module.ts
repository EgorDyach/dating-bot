import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '../database/entities/block.entity';
import { BlocksService } from './blocks.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [TypeOrmModule.forFeature([BlockEntity]), IntegrationsModule],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
