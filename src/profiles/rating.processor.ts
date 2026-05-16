import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Repository } from 'typeorm';
import { ProfileEntity } from '../database/entities/profile.entity';
import { RatingCalculationService } from './rating-calculation.service';

@Processor('rating-recalculation')
export class RatingProcessor {
  private readonly logger = new Logger(RatingProcessor.name);

  constructor(
    private readonly ratingService: RatingCalculationService,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  @Process('recalculate-profile')
  async recalculateProfile(job: Job<{ profileId: string }>) {
    try {
      const { profileId } = job.data;
      await this.ratingService.recalculateRatingForProfile(profileId);
      this.logger.log(`Rating recalculated for profile ${profileId}`);
      return { success: true, profileId };
    } catch (error) {
      this.logger.error(`Failed to recalculate rating: ${error}`);
      throw error;
    }
  }

  @Process('recalculate-all')
  async recalculateAll(job: Job) {
    try {
      const profiles = await this.profileRepository.find({
        where: { isActive: true },
      });

      let successCount = 0;
      let failCount = 0;

      for (const profile of profiles) {
        try {
          await this.ratingService.recalculateRatingForProfile(String(profile.id));
          successCount += 1;
          job.progress(Math.round((successCount + failCount) / profiles.length * 100));
        } catch (e) {
          this.logger.error(`Failed to recalculate for profile ${profile.id}: ${e}`);
          failCount += 1;
        }
      }

      this.logger.log(`Batch recalculation complete: ${successCount} success, ${failCount} failed`);
      return { successCount, failCount, totalProfiles: profiles.length };
    } catch (error) {
      this.logger.error(`Batch recalculation failed: ${error}`);
      throw error;
    }
  }
}
