import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService, RabbitMqService],
  exports: [RedisService, RabbitMqService],
})
export class IntegrationsModule {}
