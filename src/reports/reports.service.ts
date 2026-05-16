import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from '../database/entities/report.entity';
import { MetricsService } from '../integrations/metrics.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepo: Repository<ReportEntity>,
    private readonly metricsService: MetricsService,
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
  }
}
