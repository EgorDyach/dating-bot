import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../database/entities/message.entity';
import { MatchEntity } from '../database/entities/match.entity';
import { BlocksService } from '../blocks/blocks.service';

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
    private readonly blocksService: BlocksService,
  ) {}

  async sendMessage(matchId: string, senderId: string, body: string): Promise<Message> {
    const match = await this.matchRepository.findOne({ where: { id: matchId as any } });
    if (!match) throw new Error(`Совпадение ${matchId} не найдено`);

    const isParticipant = String(match.userLowId) === senderId || String(match.userHighId) === senderId;
    if (!isParticipant) throw new Error('Ты не участник этого совпадения');

    // Get the other participant
    const otherParticipantId = String(match.userLowId) === senderId ? String(match.userHighId) : String(match.userLowId);

    // Check if either participant has blocked the other
    const isBlocked = await this.blocksService.isBlocked(senderId, otherParticipantId);
    if (isBlocked) throw new Error('Невозможно отправить сообщение - один из пользователей заблокировал другого');

    const message = this.messageRepository.create({
      matchId: matchId as any,
      senderId: senderId as any,
      body: body.trim().slice(0, 4096),
    });

    const saved = await this.messageRepository.save(message);
    return {
      id: String(saved.id),
      matchId: String(saved.matchId),
      senderId: String(saved.senderId),
      body: saved.body,
      createdAt: saved.createdAt,
    };
  }

  async getMessagesForMatch(matchId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const messages = await this.messageRepository.find({
      where: { matchId: matchId as any },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return messages.reverse().map((m) => ({
      id: String(m.id),
      matchId: String(m.matchId),
      senderId: String(m.senderId),
      body: m.body,
      createdAt: m.createdAt,
    }));
  }

  async getMessagesCountForMatch(matchId: string): Promise<number> {
    return this.messageRepository.count({ where: { matchId: matchId as any } });
  }
}
