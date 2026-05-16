import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ReportEntity } from '../database/entities/report.entity';

@Injectable()
export class RatingQueueService {
  private readonly logger = new Logger(RatingQueueService.name);

  constructor(
    @InjectQueue('rating-recalculation') private readonly queue: Queue,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>,
  ) {}

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

  @Cron(CronExpression.EVERY_HOUR)
  async hideProfilesWithTooManyReports(): Promise<void> {
    const threshold = 15;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await this.reportRepository
      .createQueryBuilder('r')
      .select('r.reported_id', 'userId')
      .where('r.created_at >= :since', { since })
      .groupBy('r.reported_id')
      .having('COUNT(*) >= :threshold', { threshold })
      .getRawMany();

    for (const row of rows) {
      const updated = await this.profileRepository.update(
        { userId: row.userId, isVisibleInFeed: true },
        { isVisibleInFeed: false },
      );
      if (updated.affected) {
        this.logger.log(`Hidden profile for user ${row.userId} due to too many reports`);
      }
    }

    if (rows.length > 0) {
      this.logger.log(`Checked and hid ${rows.length} profile(s) with >=15 reports in last 7 days`);
    }
  }
}
