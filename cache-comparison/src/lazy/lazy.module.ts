import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { LazyService } from './lazy.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), MetricsModule],
  providers: [LazyService],
  exports: [LazyService],
})
export class LazyModule {}
