import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { WriteBackService } from './write-back.service';
import { MetricsService } from '../metrics/metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [WriteBackService, MetricsService],
  exports: [WriteBackService, MetricsService],
})
export class WriteBackModule {}
