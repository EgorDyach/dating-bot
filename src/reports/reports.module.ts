import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportEntity } from '../database/entities/report.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ReportsService } from './reports.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity, ProfileEntity]),
    IntegrationsModule,
    ProfilesModule,
  ],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
