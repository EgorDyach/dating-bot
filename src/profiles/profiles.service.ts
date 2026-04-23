import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from '../database/entities/profile.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  private static calcCompleteness(dto: UpsertProfileDto): number {
    let filled = 0;
    const total = 4;
    if (dto.bio && dto.bio.trim().length > 10) filled += 1;
    if (dto.birthDate) filled += 1;
    if (dto.genderCode) filled += 1;
    if (dto.city && dto.city.trim().length > 1) filled += 1;
    return Math.round((filled / total) * 100);
  }

  async upsertOwnProfile(userId: string, dto: UpsertProfileDto): Promise<ProfileEntity> {
    const existing = await this.profileRepository.findOne({ where: { userId } });
    const profile = this.profileRepository.create({
      id: existing?.id,
      userId,
      displayName: dto.displayName.trim().slice(0, 64),
      bio: dto.bio?.trim() ?? existing?.bio ?? '',
      birthDate: dto.birthDate ?? existing?.birthDate ?? null,
      genderCode: dto.genderCode ?? existing?.genderCode ?? null,
      city: dto.city?.trim() ?? existing?.city ?? '',
      isVisibleInFeed: dto.isVisibleInFeed ?? existing?.isVisibleInFeed ?? true,
      profileCompleteness: ProfilesService.calcCompleteness({
        ...dto,
        bio: dto.bio ?? existing?.bio ?? '',
        birthDate: dto.birthDate ?? existing?.birthDate ?? undefined,
        genderCode: (dto.genderCode ?? existing?.genderCode ?? undefined) as 'male' | 'female' | undefined,
        city: dto.city ?? existing?.city ?? '',
      }),
    });

    return this.profileRepository.save(profile);
  }

  async getByUserId(userId: string): Promise<ProfileEntity | null> {
    return this.profileRepository.findOne({ where: { userId } });
  }
}
