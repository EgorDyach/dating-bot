import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';
import { MatchesService } from './matches.service';

describe('MatchesService', () => {
  let service: MatchesService;
  let interactionRepository: jest.Mocked<Repository<InteractionEntity>>;

  beforeEach(async () => {
    const mockInteractionRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: getRepositoryToken(InteractionEntity),
          useValue: mockInteractionRepository,
        },
      ],
    }).compile();

    service = module.get(MatchesService);
    interactionRepository = module.get(getRepositoryToken(InteractionEntity));
  });

  describe('createMatchIfMutualLike', () => {
    it('should return true if mutual like exists', async () => {
      const viewerId = '1';
      const viewedId = '2';

      const viewerLike = { viewerId, viewedId, actionCode: 'like' };
      const viewedLike = { viewerId: viewedId, viewedId: viewerId, actionCode: 'like' };

      (interactionRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(viewerLike)
        .mockResolvedValueOnce(viewedLike);

      const result = await service.createMatchIfMutualLike(viewerId, viewedId);

      expect(result).toBe(true);
      expect(interactionRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should return false if only one user likes', async () => {
      const viewerId = '1';
      const viewedId = '2';

      (interactionRepository.findOne as jest.Mock).mockResolvedValueOnce({ viewerId, viewedId, actionCode: 'like' }).mockResolvedValueOnce(null);

      const result = await service.createMatchIfMutualLike(viewerId, viewedId);

      expect(result).toBe(false);
    });

    it('should return false if viewer has not liked', async () => {
      const viewerId = '1';
      const viewedId = '2';

      (interactionRepository.findOne as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.createMatchIfMutualLike(viewerId, viewedId);

      expect(result).toBe(false);
      expect(interactionRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMutualLikesForUser', () => {
    it('should return list of users with mutual likes', async () => {
      const userId = '1';
      const mutualUserIds = ['2', '3', '4'];

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(
          mutualUserIds.map((id) => ({ matchedUserId: id })),
        ),
      };

      (interactionRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await service.getMutualLikesForUser(userId);

      expect(result).toEqual(mutualUserIds);
      expect(result.length).toBe(3);
    });

    it('should return empty array if no mutual likes', async () => {
      const userId = '1';

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      (interactionRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await service.getMutualLikesForUser(userId);

      expect(result).toEqual([]);
    });
  });
});
