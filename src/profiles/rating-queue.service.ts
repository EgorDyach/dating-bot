import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RatingQueueService {
  private readonly logger = new Logger(RatingQueueService.name);

  constructor(@InjectQueue('rating-recalculation') private readonly queue: Queue) {}

  async scheduleProfileRatingRecalculation(profileId: string): Promise<void> {
    await this.queue.add(
      'recalculate-profile',
      { profileId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
    this.logger.log(`Scheduled rating recalculation for profile ${profileId}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleBatchRecalculation(): Promise<void> {
    const job = await this.queue.add(
      'recalculate-all',
      {},
      {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
    this.logger.log(`Batch rating recalculation scheduled: job ID ${job.id}`);
  }
}
