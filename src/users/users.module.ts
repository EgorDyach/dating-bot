import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { UserPreferenceEntity } from '../database/entities/user-preference.entity';
import { UsersService } from './users.service';
import { UserPreferencesService } from './user-preferences.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserPreferenceEntity]),
    IntegrationsModule,
  ],
  providers: [UsersService, UserPreferencesService],
  exports: [UsersService, UserPreferencesService],
})
export class UsersModule {}
