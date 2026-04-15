import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [PrismaModule, StoreModule],
})
export class AppModule {}
