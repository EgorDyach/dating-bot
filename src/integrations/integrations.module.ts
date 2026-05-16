import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { RedisService } from './redis.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  providers: [RedisService, RabbitMqService, MetricsService],
  controllers: [MetricsController],
  exports: [RedisService, RabbitMqService, MetricsService],
})
export class IntegrationsModule {}
