import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { WriteThroughService } from './write-through.service';
import { MetricsService } from '../metrics/metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [WriteThroughService, MetricsService],
  exports: [WriteThroughService, MetricsService],
})
export class WriteThroughModule {}
