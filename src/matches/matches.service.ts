import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionEntity } from '../database/entities/interaction.entity';

export type Match = {
  userId1: string;
  userId2: string;
  matchedAt: Date;
};

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(InteractionEntity)
    private readonly interactionRepository: Repository<InteractionEntity>,
  ) {}

  async createMatchIfMutualLike(viewerId: string, viewedId: string): Promise<boolean> {
    const viewerLike = await this.interactionRepository.findOne({
      where: {
        viewerId: viewerId as any,
        viewedId: viewedId as any,
        actionCode: 'like',
      },
    });

    if (!viewerLike) return false;

    const viewedLike = await this.interactionRepository.findOne({
      where: {
        viewerId: viewedId as any,
        viewedId: viewerId as any,
        actionCode: 'like',
      },
    });

    if (!viewedLike) return false;

    // Match found! (Mutual likes)
    return true;
  }

  async getMutualLikesForUser(userId: string): Promise<string[]> {
    const rows = await this.interactionRepository
      .createQueryBuilder('i1')
      .innerJoin(
        InteractionEntity,
        'i2',
        'i1.viewer_id = i2.viewed_id AND i1.viewed_id = i2.viewer_id AND i1.action_code = :like AND i2.action_code = :like',
        { like: 'like' },
      )
      .select('DISTINCT i1.viewed_id', 'matchedUserId')
      .where('i1.viewer_id = :userId', { userId: userId as any })
      .getRawMany<{ matchedUserId: string }>();

    return rows.map((r) => r.matchedUserId);
  }
}
