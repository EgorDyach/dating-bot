import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { MatchEntity } from '../database/entities/match.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { RabbitMqService } from '../integrations/rabbitmq.service';
import { RedisService } from '../integrations/redis.service';
import { MetricsService } from '../integrations/metrics.service';
import { RatingCalculationService } from '../profiles/rating-calculation.service';
import { MatchesService } from '../matches/matches.service';

export type InteractionAction = 'like' | 'skip' | 'superlike';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(InteractionEntity)
    private readonly interactionsRepository: Repository<InteractionEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
    private readonly rabbitMqService: RabbitMqService,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly ratingService: RatingCalculationService,
    private readonly matchesService: MatchesService,
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

    if (action === 'like') {
      this.metricsService.recordLike();
      const isMutual = await this.matchesService.createMatchIfMutualLike(viewerId, viewedId);
      if (isMutual) {
        const userA = Math.min(Number(viewerId), Number(viewedId));
        const userB = Math.max(Number(viewerId), Number(viewedId));
        await this.matchRepository.save(
          this.matchRepository.create({
            userLowId: String(userA),
            userHighId: String(userB),
          }),
        );
      }
    }
    if (action === 'skip') this.metricsService.recordSkip();
    if (action === 'superlike') this.metricsService.recordSuperLike();

    const viewedProfile = await this.profileRepository.findOne({ where: { userId: viewedId as any } });
    if (viewedProfile) {
      await this.ratingService.recalculateRatingForProfile(String(viewedProfile.id));
    }

    await this.redisService.clearFeed(viewerId);
    await this.rabbitMqService.publishInteraction({
      viewerId,
      viewedId,
      action,
      happenedAt: new Date().toISOString(),
    });
  }
}
