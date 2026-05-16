import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { MatchEntity } from '../database/entities/match.entity';
import { ProfileEntity } from '../database/entities/profile.entity';
import { RabbitMqService } from '../integrations/rabbitmq.service';
import { RedisService } from '../integrations/redis.service';
import { MetricsService } from '../integrations/metrics.service';
import { RatingCalculationService } from '../profiles/rating-calculation.service';
import { MatchesService } from '../matches/matches.service';
import { InteractionsService } from './interactions.service';

describe('InteractionsService', () => {
  let service: InteractionsService;
  let interactionRepository: jest.Mocked<Repository<InteractionEntity>>;
  let profileRepository: jest.Mocked<Repository<ProfileEntity>>;
  let matchRepository: jest.Mocked<Repository<MatchEntity>>;
  let rabbitMqService: jest.Mocked<RabbitMqService>;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: jest.Mocked<MetricsService>;
  let ratingService: jest.Mocked<RatingCalculationService>;
  let matchesService: jest.Mocked<MatchesService>;

  beforeEach(async () => {
    const mockInteractionRepository = {
      upsert: jest.fn(),
    };

    const mockProfileRepository = {
      findOne: jest.fn(),
    };

    const mockMatchRepository = {
      save: jest.fn(),
      create: jest.fn((data) => data),
    };

    const mockRabbitMqService = {
      publishInteraction: jest.fn(),
    };

    const mockRedisService = {
      clearFeed: jest.fn(),
    };

    const mockMetricsService = {
      recordLike: jest.fn(),
      recordSkip: jest.fn(),
      recordSuperLike: jest.fn(),
    };

    const mockRatingService = {
      recalculateRatingForProfile: jest.fn(),
    };

    const mockMatchesService = {
      createMatchIfMutualLike: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionsService,
        {
          provide: getRepositoryToken(InteractionEntity),
          useValue: mockInteractionRepository,
        },
        {
          provide: getRepositoryToken(ProfileEntity),
          useValue: mockProfileRepository,
        },
        {
          provide: getRepositoryToken(MatchEntity),
          useValue: mockMatchRepository,
        },
        {
          provide: RabbitMqService,
          useValue: mockRabbitMqService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: RatingCalculationService,
          useValue: mockRatingService,
        },
        {
          provide: MatchesService,
          useValue: mockMatchesService,
        },
      ],
    }).compile();

    service = module.get(InteractionsService);
    interactionRepository = module.get(getRepositoryToken(InteractionEntity));
    profileRepository = module.get(getRepositoryToken(ProfileEntity));
    matchRepository = module.get(getRepositoryToken(MatchEntity));
    rabbitMqService = module.get(RabbitMqService);
    redisService = module.get(RedisService);
    metricsService = module.get(MetricsService);
    ratingService = module.get(RatingCalculationService);
    matchesService = module.get(MatchesService);
  });

  describe('react', () => {
    it('should record a like and update metrics', async () => {
      const viewerId = '1';
      const viewedId = '2';
      const profileId = '101';

      (profileRepository.findOne as jest.Mock).mockResolvedValue({ id: profileId });
      (ratingService.recalculateRatingForProfile as jest.Mock).mockResolvedValue({});
      (matchesService.createMatchIfMutualLike as jest.Mock).mockResolvedValue(false);

      await service.react(viewerId, viewedId, 'like');

      expect(interactionRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerId,
          viewedId,
          actionCode: 'like',
        }),
        ['viewerId', 'viewedId'],
      );
      expect(metricsService.recordLike).toHaveBeenCalled();
      expect(ratingService.recalculateRatingForProfile).toHaveBeenCalledWith(profileId);
      expect(redisService.clearFeed).toHaveBeenCalledWith(viewerId);
      expect(rabbitMqService.publishInteraction).toHaveBeenCalled();
    });

    it('should record a skip and update metrics', async () => {
      const viewerId = '1';
      const viewedId = '2';
      const profileId = '101';

      (profileRepository.findOne as jest.Mock).mockResolvedValue({ id: profileId });
      (ratingService.recalculateRatingForProfile as jest.Mock).mockResolvedValue({});

      await service.react(viewerId, viewedId, 'skip');

      expect(metricsService.recordSkip).toHaveBeenCalled();
      expect(ratingService.recalculateRatingForProfile).toHaveBeenCalledWith(profileId);
    });

    it('should create a match on mutual like', async () => {
      const viewerId = '5';
      const viewedId = '10';
      const profileId = '101';

      (profileRepository.findOne as jest.Mock).mockResolvedValue({ id: profileId });
      (ratingService.recalculateRatingForProfile as jest.Mock).mockResolvedValue({});
      (matchesService.createMatchIfMutualLike as jest.Mock).mockResolvedValue(true);
      (matchRepository.save as jest.Mock).mockResolvedValue({});

      await service.react(viewerId, viewedId, 'like');

      expect(matchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userLowId: '5',
          userHighId: '10',
        }),
      );
    });

    it('should record superlike', async () => {
      const viewerId = '1';
      const viewedId = '2';
      const profileId = '101';

      (profileRepository.findOne as jest.Mock).mockResolvedValue({ id: profileId });
      (ratingService.recalculateRatingForProfile as jest.Mock).mockResolvedValue({});

      await service.react(viewerId, viewedId, 'superlike');

      expect(metricsService.recordSuperLike).toHaveBeenCalled();
      expect(ratingService.recalculateRatingForProfile).toHaveBeenCalledWith(profileId);
    });
  });
});
