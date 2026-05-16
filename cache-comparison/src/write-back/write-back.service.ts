import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Product } from '../database/product.entity';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class WriteBackService implements OnModuleInit, OnModuleDestroy {
  private cache: Redis;
  private writeQueue: Map<number, Partial<Product>> = new Map();
  private flushInterval: NodeJS.Timer;
  private flushing = false;

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private metricsService: MetricsService,
  ) {
    this.cache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  onModuleInit() {
    // Flush to DB every 5 seconds
    this.flushInterval = setInterval(() => this.flushToDB(), 5000);
  }

  async getProduct(id: number): Promise<Product | null> {
    const cacheKey = `wb:product:${id}`;

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.metricsService.recordCacheHit('write-back');
      return JSON.parse(cached);
    }

    // Cache miss: fetch from DB
    this.metricsService.recordCacheMiss('write-back');
    this.metricsService.recordDbRead('write-back');
    const product = await this.productRepo.findOne({ where: { id } });

    if (product) {
      // Store in cache with 1 hour TTL
      await this.cache.setex(cacheKey, 3600, JSON.stringify(product));
    }

    return product || null;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product | null> {
    // Write only to cache, queue for DB flush (Write-Back)
    const cacheKey = `wb:product:${id}`;
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) return null;

    const updated = { ...product, ...data };

    // Store in cache
    await this.cache.setex(cacheKey, 3600, JSON.stringify(updated));

    // Queue for DB write
    this.writeQueue.set(id, data);

    return updated as Product;
  }

  async flushToDB() {
    if (this.flushing || this.writeQueue.size === 0) return;

    this.flushing = true;
    const queueSize = this.writeQueue.size;

    try {
      const entries = Array.from(this.writeQueue.entries());

      for (const [id, data] of entries) {
        const product = await this.productRepo.findOne({ where: { id } });
        if (product) {
          Object.assign(product, data);
          await this.productRepo.save(product);
          this.metricsService.recordDbWrite('write-back');
        }
        this.writeQueue.delete(id);
      }

      console.log(`[Write-Back] Flushed ${queueSize} items to DB`);
    } catch (error) {
      console.error('[Write-Back] Flush error:', error);
    } finally {
      this.flushing = false;
    }
  }

  getPendingCount(): number {
    return this.writeQueue.size;
  }

  async onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush
    if (this.writeQueue.size > 0) {
      await this.flushToDB();
    }
    await this.cache.quit();
  }
}
