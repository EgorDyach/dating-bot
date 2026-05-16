import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Product } from '../database/product.entity';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class WriteThroughService {
  private cache: Redis;

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private metricsService: MetricsService,
  ) {
    this.cache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getProduct(id: number): Promise<Product | null> {
    const cacheKey = `wt:product:${id}`;

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.metricsService.recordCacheHit('write-through');
      return JSON.parse(cached);
    }

    // Cache miss: fetch from DB
    this.metricsService.recordCacheMiss('write-through');
    this.metricsService.recordDbRead('write-through');
    const product = await this.productRepo.findOne({ where: { id } });

    if (product) {
      // Store in cache with 1 hour TTL
      await this.cache.setex(cacheKey, 3600, JSON.stringify(product));
    }

    return product || null;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product | null> {
    // Write to both cache and DB simultaneously (Write-Through)
    const cacheKey = `wt:product:${id}`;
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) return null;

    Object.assign(product, data);
    const updated = await this.productRepo.save(product);
    this.metricsService.recordDbWrite('write-through');

    // Update cache at the same time
    await this.cache.setex(cacheKey, 3600, JSON.stringify(updated));

    return updated;
  }

  async onModuleDestroy() {
    await this.cache.quit();
  }
}
