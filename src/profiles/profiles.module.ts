import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProfileEntity])],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
