import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { MatchEntity } from '../database/entities/match.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';

export interface UserStats {
  profileViewsCount: number;
  likesReceived: number;
  matchesCount: number;
  currentRating: number;
  likesGiven: number;
  skipsGiven: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(InteractionEntity)
    private readonly interactionRepo: Repository<InteractionEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepo: Repository<MatchEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,
    @InjectRepository(ProfileRatingEntity)
    private readonly ratingRepo: Repository<ProfileRatingEntity>,
  ) {}

  async getUserStats(userId: string): Promise<UserStats> {
    const [
      profileViewsCount,
      likesReceived,
      likesGiven,
      skipsGiven,
      matchesCount,
      currentRating,
    ] = await Promise.all([
      this.interactionRepo.count({ where: { viewedId: userId } }),
      this.interactionRepo.count({
        where: { viewedId: userId, actionCode: 'like' },
      }),
      this.interactionRepo.count({
        where: { viewerId: userId, actionCode: 'like' },
      }),
      this.interactionRepo.count({
        where: { viewerId: userId, actionCode: 'skip' },
      }),
      this.getMatchesCount(userId),
      this.getCurrentRating(userId),
    ]);

    return {
      profileViewsCount,
      likesReceived,
      likesGiven,
      skipsGiven,
      matchesCount,
      currentRating,
    };
  }

  private async getMatchesCount(userId: string): Promise<number> {
    return this.matchRepo
      .createQueryBuilder('m')
      .where('m.user_low_id = :userId OR m.user_high_id = :userId', {
        userId,
      })
      .getCount();
  }

  private async getCurrentRating(userId: string): Promise<number> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return 0;

    const rating = await this.ratingRepo.findOne({
      where: { profileId: profile.id },
    });
    return rating ? parseFloat(rating.combinedScore) : 0;
  }
}
