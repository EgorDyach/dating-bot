import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockEntity } from '../database/entities/block.entity';
import { RedisService } from '../integrations/redis.service';
import { MetricsService } from '../integrations/metrics.service';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
  ) {}

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    // Upsert: idempotent
    await this.blockRepo.upsert(
      { blockerId, blockedId },
      { conflictPaths: ['blocker_id', 'blocked_id'] },
    );

    // Clear feed cache for both users
    await Promise.all([
      this.redisService.clearFeed(blockerId),
      this.redisService.clearFeed(blockedId),
    ]);

    // Record metric
    this.metricsService.recordBlock();
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.blockRepo.findOne({
      where: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    });
    return !!block;
  }
}
