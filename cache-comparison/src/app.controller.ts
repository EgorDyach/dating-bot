import { Controller, Get, Put, Param, Body, Query } from '@nestjs/common';
import { LazyService } from './lazy/lazy.service';
import { WriteThroughService } from './write-through/write-through.service';
import { WriteBackService } from './write-back/write-back.service';
import { MetricsService } from './metrics/metrics.service';
import { Product } from './database/product.entity';

@Controller()
export class AppController {
  constructor(
    private lazyService: LazyService,
    private writeThroughService: WriteThroughService,
    private writeBackService: WriteBackService,
    private metricsService: MetricsService,
  ) {}

  // Lazy Loading / Cache-Aside
  @Get('/lazy/:id')
  async getLazy(@Param('id') id: string): Promise<Product | null> {
    return this.lazyService.getProduct(parseInt(id));
  }

  @Put('/lazy/:id')
  async updateLazy(
    @Param('id') id: string,
    @Body() data: Partial<Product>,
  ): Promise<Product | null> {
    return this.lazyService.updateProduct(parseInt(id), data);
  }

  // Write-Through
  @Get('/write-through/:id')
  async getWriteThrough(@Param('id') id: string): Promise<Product | null> {
    return this.writeThroughService.getProduct(parseInt(id));
  }

  @Put('/write-through/:id')
  async updateWriteThrough(
    @Param('id') id: string,
    @Body() data: Partial<Product>,
  ): Promise<Product | null> {
    return this.writeThroughService.updateProduct(parseInt(id), data);
  }

  // Write-Back
  @Get('/write-back/:id')
  async getWriteBack(@Param('id') id: string): Promise<Product | null> {
    return this.writeBackService.getProduct(parseInt(id));
  }

  @Put('/write-back/:id')
  async updateWriteBack(
    @Param('id') id: string,
    @Body() data: Partial<Product>,
  ): Promise<Product | null> {
    return this.writeBackService.updateProduct(parseInt(id), data);
  }

  @Get('/write-back/flush')
  async flushWriteBack(): Promise<{ pending: number; flushed: boolean }> {
    const pending = this.writeBackService.getPendingCount();
    await this.writeBackService['flushToDB']();
    return { pending, flushed: true };
  }

  // Metrics
  @Get('/metrics')
  async getMetrics(@Query('strategy') strategy?: string) {
    if (strategy) {
      return this.metricsService.getMetrics(strategy);
    }
    return this.metricsService.getAllMetrics();
  }

  @Put('/metrics/reset')
  async resetMetrics(@Query('strategy') strategy?: string) {
    this.metricsService.reset(strategy);
    return { message: 'Metrics reset', strategy: strategy || 'all' };
  }

  @Get('/health')
  async health() {
    return { status: 'ok' };
  }
}
