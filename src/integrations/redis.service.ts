import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { readEnv } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis = new Redis(readEnv().redisUrl);

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async pushFeedBatch(userId: string, candidates: string[]): Promise<void> {
    if (!candidates.length) return;
    await this.redis.rpush(this.feedKey(userId), ...candidates);
  }

  async popFeedCandidate(userId: string): Promise<string | null> {
    return this.redis.lpop(this.feedKey(userId));
  }

  async clearFeed(userId: string): Promise<void> {
    await this.redis.del(this.feedKey(userId));
  }

  private feedKey(userId: string): string {
    return `feed:user:${userId}`;
  }
}
