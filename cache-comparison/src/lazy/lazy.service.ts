import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Product } from '../database/product.entity';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class LazyService {
  private cache: Redis;

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private metricsService: MetricsService,
  ) {
    this.cache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getProduct(id: number): Promise<Product | null> {
    const cacheKey = `lazy:product:${id}`;

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.metricsService.recordCacheHit('lazy');
      return JSON.parse(cached);
    }

    // Cache miss: fetch from DB
    this.metricsService.recordCacheMiss('lazy');
    this.metricsService.recordDbRead('lazy');
    const product = await this.productRepo.findOne({ where: { id } });

    if (product) {
      // Store in cache with 1 hour TTL
      await this.cache.setex(cacheKey, 3600, JSON.stringify(product));
    }

    return product || null;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product | null> {
    // Write directly to DB (Write-Around strategy)
    this.metricsService.recordDbWrite('lazy');
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) return null;

    Object.assign(product, data);
    const updated = await this.productRepo.save(product);

    // Invalidate cache
    const cacheKey = `lazy:product:${id}`;
    await this.cache.del(cacheKey);

    return updated;
  }

  async onModuleDestroy() {
    await this.cache.quit();
  }
}
