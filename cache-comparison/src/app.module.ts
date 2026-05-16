import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './database/product.entity';
import { AppController } from './app.controller';
import { LazyModule } from './lazy/lazy.module';
import { WriteThroughModule } from './write-through/write-through.module';
import { WriteBackModule } from './write-back/write-back.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5438'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'cache_test',
      entities: [Product],
      synchronize: false,
      logging: false,
    }),
    MetricsModule,
    LazyModule,
    WriteThroughModule,
    WriteBackModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
