import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MetricsService } from '../integrations/metrics.service';

type RatingResult = {
  primaryScore: number;
  behavioralScore: number;
  combinedScore: number;
};

@Injectable()
export class RatingCalculationService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(InteractionEntity)
    private readonly interactionRepository: Repository<InteractionEntity>,
    @InjectRepository(ProfileRatingEntity)
    private readonly ratingRepository: Repository<ProfileRatingEntity>,
    @InjectRepository(ProfilePhotoEntity)
    private readonly photoRepository: Repository<ProfilePhotoEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly metricsService: MetricsService,
  ) {}

  async recalculateRatingForProfile(profileId: string): Promise<RatingResult> {
    const startTime = Date.now();
    const profile = await this.profileRepository.findOne({ where: { id: profileId as any } });
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    const primary = await this.calculatePrimaryScore(profile);
    const behavioral = await this.calculateBehavioralScore(profile.userId);
    const combined = this.calculateCombinedScore(primary, behavioral);

    const rating = await this.ratingRepository.findOne({ where: { profileId: profileId as any } });
    if (rating) {
      rating.primaryScore = String(primary);
      rating.behavioralScore = String(behavioral);
      rating.combinedScore = String(combined);
      await this.ratingRepository.save(rating);
    } else {
      await this.ratingRepository.save(
        this.ratingRepository.create({
          profileId: profileId as any,
          primaryScore: String(primary),
          behavioralScore: String(behavioral),
          combinedScore: String(combined),
        }),
      );
    }

    const duration = Date.now() - startTime;
    this.metricsService.recordRatingRecalculationDuration(duration);
    this.metricsService.setProfileRating(profileId, combined);

    return { primaryScore: primary, behavioralScore: behavioral, combinedScore: combined };
  }

  private async calculatePrimaryScore(profile: ProfileEntity): Promise<number> {
    const BASE_SCORE = 10;
    const COMPLETENESS_WEIGHT = 0.5;
    const PHOTO_WEIGHT = 0.25;
    const ACTIVITY_WEIGHT = 0.25;

    const completenessScore = (profile.profileCompleteness / 100) * 25;
    const photoCount = await this.photoRepository.count({ where: { profileId: profile.id as any } });
    const photoBonus = photoCount > 0 ? 10 : 0;
    const activityBonus = profile.isActive ? 5 : 0;

    return (
      BASE_SCORE +
      completenessScore * COMPLETENESS_WEIGHT +
      photoBonus * PHOTO_WEIGHT +
      activityBonus * ACTIVITY_WEIGHT
    );
  }

  private async calculateBehavioralScore(userId: string): Promise<number> {
    const interactions = await this.interactionRepository.find({
      where: { viewedId: userId as any },
    });

    let likes = 0;
    let skips = 0;
    let superLikes = 0;

    interactions.forEach((i) => {
      if (i.actionCode === 'like') likes += 1;
      else if (i.actionCode === 'skip') skips += 1;
      else if (i.actionCode === 'superlike') superLikes += 5;
    });

    const total = likes + skips;
    const totalInteractions = Math.min(total, 200);
    const likeRatio = total > 0 ? likes / total : 0;
    const mutualLikes = await this.countMutualLikes(userId);

    return (
      likes * 0.5 +
      superLikes * 1.5 +
      likeRatio * 20 +
      Math.min(mutualLikes * 2, 30)
    );
  }

  private calculateCombinedScore(primaryScore: number, behavioralScore: number): number {
    const PRIMARY_WEIGHT = 0.4;
    const BEHAVIORAL_WEIGHT = 0.6;

    return primaryScore * PRIMARY_WEIGHT + behavioralScore * BEHAVIORAL_WEIGHT;
  }

  private async countMutualLikes(userId: string): Promise<number> {
    const result = await this.interactionRepository
      .createQueryBuilder('i1')
      .innerJoin(
        InteractionEntity,
        'i2',
        'i1.viewer_id = i2.viewed_id AND i1.viewed_id = i2.viewer_id AND i1.action_code = :like AND i2.action_code = :like',
        { like: 'like' },
      )
      .where('i1.viewed_id = :userId', { userId: userId as any })
      .getCount();

    return result;
  }
}
