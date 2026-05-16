import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { MatchEntity } from '../database/entities/match.entity';
import { MessageEntity } from '../database/entities/message.entity';
import { MatchesService } from './matches.service';
import { MessagesService } from './messages.service';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InteractionEntity, MatchEntity, MessageEntity]),
    BlocksModule,
  ],
  providers: [MatchesService, MessagesService],
  exports: [MatchesService, MessagesService],
})
export class MatchesModule {}
