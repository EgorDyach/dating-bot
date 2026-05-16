import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserPreferenceEntity } from '../database/entities/user-preference.entity';
import { RedisService } from '../integrations/redis.service';
import { MetricsService } from '../integrations/metrics.service';
import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let profileRepository: jest.Mocked<Repository<ProfileEntity>>;
  let prefRepository: jest.Mocked<Repository<UserPreferenceEntity>>;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockProfileRepository = {
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const mockPrefRepository = {
      findOne: jest.fn(),
    };

    const mockRedisService = {
      popFeedCandidate: jest.fn(),
      pushFeedBatch: jest.fn(),
      clearFeed: jest.fn(),
    };

    const mockMetricsService = {
      recordFeedBatchDuration: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: getRepositoryToken(ProfileEntity),
          useValue: mockProfileRepository,
        },
        {
          provide: getRepositoryToken(UserPreferenceEntity),
          useValue: mockPrefRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get(FeedService);
    profileRepository = module.get(getRepositoryToken(ProfileEntity));
    prefRepository = module.get(getRepositoryToken(UserPreferenceEntity));
    redisService = module.get(RedisService);
    metricsService = module.get(MetricsService);
  });

  describe('getNextProfile', () => {
    it('should return a profile from redis cache if available', async () => {
      const viewerId = '1';
      const nextUserId = '2';

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          userId: nextUserId,
          displayName: 'Test User',
          bio: 'Test bio',
          city: 'Test City',
          combinedScore: '10.5',
          photoStorageKey: 'test/photo.jpg',
        }),
      };

      (profileRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      (redisService.popFeedCandidate as jest.Mock).mockResolvedValue(nextUserId);

      const result = await service.getNextProfile(viewerId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(nextUserId);
      expect(redisService.popFeedCandidate).toHaveBeenCalledWith(viewerId);
    });

    it('should return null if no profiles available', async () => {
      const viewerId = '1';

      (redisService.popFeedCandidate as jest.Mock).mockResolvedValue(null);
      (profileRepository.createQueryBuilder as jest.Mock)().getRawMany.mockResolvedValue([]);

      const result = await service.getNextProfile(viewerId);

      expect(result).toBeNull();
    });

    it('should build batch if redis cache is empty', async () => {
      const viewerId = '1';
      const nextUserId = '2';

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getRawOne: jest.fn(),
      };

      mockQueryBuilder.getRawMany.mockResolvedValueOnce([{ userId: nextUserId }]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        userId: nextUserId,
        displayName: 'Test User',
        bio: 'Test bio',
        city: 'Test City',
        combinedScore: '10.5',
        photoStorageKey: null,
      });

      (profileRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      (redisService.popFeedCandidate as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(nextUserId);

      const result = await service.getNextProfile(viewerId);

      expect(result?.userId).toBe(nextUserId);
      expect(redisService.pushFeedBatch).toHaveBeenCalled();
    });
  });
});
