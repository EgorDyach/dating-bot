import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportEntity } from '../database/entities/report.entity';
import { ReportsService } from './reports.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReportEntity]), IntegrationsModule],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
