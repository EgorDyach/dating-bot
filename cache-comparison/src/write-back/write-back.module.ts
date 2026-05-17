import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/product.entity';
import { WriteBackService } from './write-back.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), MetricsModule],
  providers: [WriteBackService],
  exports: [WriteBackService],
})
export class WriteBackModule {}
