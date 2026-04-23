import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { RabbitMqService } from '../integrations/rabbitmq.service';
import { RedisService } from '../integrations/redis.service';

export type InteractionAction = 'like' | 'skip' | 'superlike';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(InteractionEntity)
    private readonly interactionsRepository: Repository<InteractionEntity>,
    private readonly rabbitMqService: RabbitMqService,
    private readonly redisService: RedisService,
  ) {}

  async react(viewerId: string, viewedId: string, action: InteractionAction): Promise<void> {
    await this.interactionsRepository.upsert(
      {
        viewerId,
        viewedId,
        actionCode: action,
      },
      ['viewerId', 'viewedId'],
    );

    await this.redisService.clearFeed(viewerId);
    await this.rabbitMqService.publishInteraction({
      viewerId,
      viewedId,
      action,
      happenedAt: new Date().toISOString(),
    });
  }
}
