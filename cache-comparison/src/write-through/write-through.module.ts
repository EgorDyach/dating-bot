import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { WriteThroughService } from './write-through.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), MetricsModule],
  providers: [WriteThroughService],
  exports: [WriteThroughService],
})
export class WriteThroughModule {}
