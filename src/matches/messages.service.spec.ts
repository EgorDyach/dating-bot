import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchEntity } from '../database/entities/match.entity';
import { MessageEntity } from '../database/entities/message.entity';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let messageRepository: jest.Mocked<Repository<MessageEntity>>;
  let matchRepository: jest.Mocked<Repository<MatchEntity>>;

  beforeEach(async () => {
    const mockMessageRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };

    const mockMatchRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(MessageEntity),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(MatchEntity),
          useValue: mockMatchRepository,
        },
      ],
    }).compile();

    service = module.get(MessagesService);
    messageRepository = module.get(getRepositoryToken(MessageEntity));
    matchRepository = module.get(getRepositoryToken(MatchEntity));
  });

  describe('sendMessage', () => {
    it('should send a message from a match participant', async () => {
      const matchId = '1';
      const senderId = '100';
      const body = 'Hello!';

      const match = {
        id: matchId,
        userLowId: '100',
        userHighId: '101',
        createdAt: new Date(),
      } as MatchEntity;

      (matchRepository.findOne as jest.Mock).mockResolvedValue(match);
      (messageRepository.save as jest.Mock).mockResolvedValue({
        id: '1',
        matchId,
        senderId,
        body,
        createdAt: new Date(),
      });

      const result = await service.sendMessage(matchId, senderId, body);

      expect(result).toBeDefined();
      expect(result.senderId).toBe(senderId);
      expect(result.body).toBe(body);
      expect(messageRepository.create).toHaveBeenCalled();
      expect(messageRepository.save).toHaveBeenCalled();
    });

    it('should throw error if match not found', async () => {
      (matchRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.sendMessage('999', '100', 'Hello')).rejects.toThrow('Match 999 not found');
    });

    it('should throw error if user is not a participant', async () => {
      const matchId = '1';
      const senderId = '999';

      const match = {
        id: matchId,
        userLowId: '100',
        userHighId: '101',
      } as MatchEntity;

      (matchRepository.findOne as jest.Mock).mockResolvedValue(match);

      await expect(service.sendMessage(matchId, senderId, 'Hello')).rejects.toThrow(
        'User is not a participant in this match',
      );
    });

    it('should truncate message if too long', async () => {
      const matchId = '1';
      const senderId = '100';
      const longBody = 'a'.repeat(5000);

      const match = {
        id: matchId,
        userLowId: '100',
        userHighId: '101',
      } as MatchEntity;

      (matchRepository.findOne as jest.Mock).mockResolvedValue(match);
      (messageRepository.save as jest.Mock).mockResolvedValue({
        id: '1',
        matchId,
        senderId,
        body: longBody.slice(0, 4096),
        createdAt: new Date(),
      });

      await service.sendMessage(matchId, senderId, longBody);

      const createCall = (messageRepository.create as jest.Mock).mock.calls[0][0];
      expect(createCall.body.length).toBeLessThanOrEqual(4096);
    });
  });

  describe('getMessagesForMatch', () => {
    it('should return messages for a match in chronological order', async () => {
      const matchId = '1';
      const messages = [
        {
          id: '2',
          matchId,
          senderId: '101',
          body: 'Hi there!',
          createdAt: new Date(Date.now() - 1000),
        },
        {
          id: '1',
          matchId,
          senderId: '100',
          body: 'Hello',
          createdAt: new Date(),
        },
      ];

      (messageRepository.find as jest.Mock).mockResolvedValue(messages);

      const result = await service.getMessagesForMatch(matchId);

      expect(result).toHaveLength(2);
      expect(result[0].body).toBe('Hello');
      expect(result[1].body).toBe('Hi there!');
      expect(messageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId: matchId as any },
        }),
      );
    });
  });

  describe('getMessagesCountForMatch', () => {
    it('should return message count for a match', async () => {
      const matchId = '1';

      (messageRepository.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getMessagesCountForMatch(matchId);

      expect(result).toBe(5);
      expect(messageRepository.count).toHaveBeenCalledWith({ where: { matchId: matchId as any } });
    });
  });
});
