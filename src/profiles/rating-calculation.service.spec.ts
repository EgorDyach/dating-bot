import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { ProfileRatingEntity } from '../database/entities/profile-rating.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MetricsService } from '../integrations/metrics.service';
import { RatingCalculationService } from './rating-calculation.service';

describe('RatingCalculationService', () => {
  let service: RatingCalculationService;
  let profileRepository: jest.Mocked<Repository<ProfileEntity>>;
  let interactionRepository: jest.Mocked<Repository<InteractionEntity>>;
  let ratingRepository: jest.Mocked<Repository<ProfileRatingEntity>>;
  let photoRepository: jest.Mocked<Repository<ProfilePhotoEntity>>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockProfileRepository = {
      findOne: jest.fn(),
    };

    const mockInteractionRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      })),
    };

    const mockRatingRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
    };

    const mockPhotoRepository = {
      count: jest.fn(),
    };

    const mockMetricsService = {
      recordRatingRecalculationDuration: jest.fn(),
      setProfileRating: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingCalculationService,
        {
          provide: getRepositoryToken(ProfileEntity),
          useValue: mockProfileRepository,
        },
        {
          provide: getRepositoryToken(InteractionEntity),
          useValue: mockInteractionRepository,
        },
        {
          provide: getRepositoryToken(ProfileRatingEntity),
          useValue: mockRatingRepository,
        },
        {
          provide: getRepositoryToken(ProfilePhotoEntity),
          useValue: mockPhotoRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {},
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get(RatingCalculationService);
    profileRepository = module.get(getRepositoryToken(ProfileEntity));
    interactionRepository = module.get(getRepositoryToken(InteractionEntity));
    ratingRepository = module.get(getRepositoryToken(ProfileRatingEntity));
    photoRepository = module.get(getRepositoryToken(ProfilePhotoEntity));
    metricsService = module.get(MetricsService);
  });

  describe('recalculateRatingForProfile', () => {
    it('should calculate and save rating for a profile', async () => {
      const profileId = '1';
      const profile = {
        id: profileId,
        userId: '100',
        displayName: 'Test User',
        bio: 'Test bio',
        city: 'Test City',
        profileCompleteness: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ProfileEntity;

      (profileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (photoRepository.count as jest.Mock).mockResolvedValue(1);
      (interactionRepository.find as jest.Mock).mockResolvedValue([
        { actionCode: 'like', viewedId: '100' },
        { actionCode: 'like', viewedId: '100' },
        { actionCode: 'skip', viewedId: '100' },
      ]);
      (ratingRepository.findOne as jest.Mock).mockResolvedValue(null);
      (ratingRepository.save as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateRatingForProfile(profileId);

      expect(result).toHaveProperty('primaryScore');
      expect(result).toHaveProperty('behavioralScore');
      expect(result).toHaveProperty('combinedScore');
      expect(result.combinedScore).toBeGreaterThan(0);
      expect(ratingRepository.save).toHaveBeenCalled();
      expect(metricsService.setProfileRating).toHaveBeenCalledWith(profileId, expect.any(Number));
    });

    it('should throw error if profile not found', async () => {
      (profileRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.recalculateRatingForProfile('999')).rejects.toThrow('Profile 999 not found');
    });

    it('should update existing rating', async () => {
      const profileId = '1';
      const profile = {
        id: profileId,
        userId: '100',
        profileCompleteness: 50,
        isActive: true,
      } as ProfileEntity;

      const existingRating = {
        profileId: profileId,
        primaryScore: '10',
        behavioralScore: '5',
        combinedScore: '7.5',
      };

      (profileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (photoRepository.count as jest.Mock).mockResolvedValue(0);
      (interactionRepository.find as jest.Mock).mockResolvedValue([]);
      (ratingRepository.findOne as jest.Mock).mockResolvedValue(existingRating);
      (ratingRepository.save as jest.Mock).mockResolvedValue(existingRating);

      await service.recalculateRatingForProfile(profileId);

      expect(ratingRepository.save).toHaveBeenCalled();
      const saved = (ratingRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.primaryScore).toBeDefined();
      expect(saved.behavioralScore).toBeDefined();
      expect(saved.combinedScore).toBeDefined();
    });
  });
});
