import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from '../database/entities/report.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { MetricsService } from '../integrations/metrics.service';
import { RatingQueueService } from '../profiles/rating-queue.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepo: Repository<ReportEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    private readonly metricsService: MetricsService,
    private readonly ratingQueueService: RatingQueueService,
  ) {}

  async reportUser(
    reporterId: string,
    reportedId: string,
    reasonCode: string,
  ): Promise<void> {
    const report = this.reportRepo.create({
      reporterId,
      reportedId,
      reasonCode,
    });
    await this.reportRepo.save(report);
    this.metricsService.recordReport(reasonCode);

    // Recalculate rating for the reported user due to new penalty
    const profile = await this.profileRepository.findOne({
      where: { userId: reportedId as any },
    });
    if (profile) {
      await this.ratingQueueService.scheduleProfileRatingRecalculation(
        profile.id.toString(),
      );
    }
  }
}
