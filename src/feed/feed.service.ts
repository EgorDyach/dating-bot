import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserPreferenceEntity } from '../database/entities/user-preference.entity';
import { RedisService } from '../integrations/redis.service';

type FeedCard = {
  userId: string;
  displayName: string;
  bio: string;
  city: string;
  combinedScore: number;
  photoFileId: string | null;
};

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(UserPreferenceEntity)
    private readonly prefRepository: Repository<UserPreferenceEntity>,
    private readonly redisService: RedisService,
  ) {}

  async getNextProfile(viewerId: string): Promise<FeedCard | null> {
    let nextUserId = await this.redisService.popFeedCandidate(viewerId);
    if (!nextUserId) {
      const ids = await this.buildBatch(viewerId, 10);
      if (!ids.length) {
        return null;
      }
      await this.redisService.pushFeedBatch(viewerId, ids);
      nextUserId = await this.redisService.popFeedCandidate(viewerId);
    }
    if (!nextUserId) return null;

    const row = await this.profileRepository
      .createQueryBuilder('p')
      .leftJoin(ProfileRatingEntity, 'r', 'r.profile_id = p.id')
      .leftJoin(
        ProfilePhotoEntity,
        'pp',
        'pp.profile_id = p.id AND pp.sort_order = (SELECT MIN(pp2.sort_order) FROM profile_photos pp2 WHERE pp2.profile_id = p.id)',
      )
      .select([
        'p.user_id AS "userId"',
        'p.display_name AS "displayName"',
        'p.bio AS "bio"',
        'p.city AS "city"',
        'COALESCE(r.combined_score, 0) AS "combinedScore"',
        'pp.storage_key AS "photoStorageKey"',
      ])
      .where('p.user_id = :uid', { uid: nextUserId })
      .getRawOne<
        FeedCard & {
          photoStorageKey: string | null;
        }
      >();

    if (!row) return null;
    return {
      ...row,
      combinedScore: Number(row.combinedScore || 0),
      photoFileId: this.extractTelegramFileId(row.photoStorageKey),
    };
  }

  private extractTelegramFileId(storageKey: string | null): string | null {
    if (!storageKey) return null;
    const parts = storageKey.split('/');
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }

  private async buildBatch(viewerId: string, limit: number): Promise<string[]> {
    const pref = await this.prefRepository.findOne({ where: { userId: viewerId } });

    const qb = this.profileRepository
      .createQueryBuilder('p')
      .leftJoin(ProfileRatingEntity, 'r', 'r.profile_id = p.id')
      .leftJoin(
        InteractionEntity,
        'i',
        'i.viewer_id = :viewerId AND i.viewed_id = p.user_id',
        { viewerId },
      )
      .select('p.user_id', 'userId')
      .where('p.user_id <> :viewerId', { viewerId })
      .andWhere('p.is_active = true')
      .andWhere('p.is_visible_in_feed = true')
      .andWhere('i.id IS NULL')
      .orderBy('COALESCE(r.combined_score, 0)', 'DESC')
      .addOrderBy('p.profile_completeness', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .limit(limit);

    if (pref?.cityPreference && pref.cityPreference.trim()) {
      qb.andWhere('LOWER(p.city) = LOWER(:city)', { city: pref.cityPreference.trim() });
    }
    if (pref?.genderPreference && pref.genderPreference !== 'any') {
      qb.andWhere('p.gender_code = :gender', { gender: pref.genderPreference });
    }

    const rows = await qb.getRawMany<{ userId: string }>();
    return rows.map((row) => row.userId);
  }
}
