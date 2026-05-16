import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ProfilesService } from './profiles.service';
import { RatingCalculationService } from './rating-calculation.service';
import { RatingProcessor } from './rating.processor';
import { RatingQueueService } from './rating-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfileEntity,
      ProfilePhotoEntity,
      ProfileRatingEntity,
      InteractionEntity,
      UserEntity,
    ]),
    BullModule.registerQueue({
      name: 'rating-recalculation',
    }),
  ],
  providers: [ProfilesService, RatingCalculationService, RatingProcessor, RatingQueueService],
  exports: [ProfilesService, RatingCalculationService, RatingQueueService],
})
export class ProfilesModule {}
