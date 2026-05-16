import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { LazyService } from './lazy.service';
import { MetricsService } from '../metrics/metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [LazyService, MetricsService],
  exports: [LazyService, MetricsService],
})
export class LazyModule {}
