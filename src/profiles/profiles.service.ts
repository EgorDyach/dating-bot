import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from '../database/entities/profile.entity';
import { ProfilePhotoEntity } from '../database/entities/profile-photo.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

type EditableProfileField = 'displayName' | 'bio' | 'city' | 'birthDate' | 'genderCode';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    @InjectRepository(ProfilePhotoEntity)
    private readonly profilePhotosRepository: Repository<ProfilePhotoEntity>,
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

  async getOrCreateByUserId(userId: string, defaultDisplayName: string): Promise<ProfileEntity> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    return this.profileRepository.save(
      this.profileRepository.create({
        userId,
        displayName: defaultDisplayName.trim().slice(0, 64) || 'Пользователь',
        bio: '',
        city: '',
        profileCompleteness: 0,
        isVisibleInFeed: true,
      }),
    );
  }

  async updateField(userId: string, field: EditableProfileField, value: string): Promise<ProfileEntity> {
    const profile = await this.getOrCreateByUserId(userId, 'Пользователь');

    if (field === 'displayName') {
      profile.displayName = value.trim().slice(0, 64) || profile.displayName;
    } else if (field === 'bio') {
      profile.bio = value.trim().slice(0, 2000);
    } else if (field === 'city') {
      profile.city = value.trim().slice(0, 128);
    } else if (field === 'birthDate') {
      // Validate ISO date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value.trim())) {
        throw new Error('Неверный формат даты. Используй ДД.ММ.ГГГГ');
      }
      const date = new Date(value.trim());
      if (isNaN(date.getTime())) {
        throw new Error('Неверная дата');
      }
      // Store as YYYY-MM-DD string (PostgreSQL date type)
      profile.birthDate = value.trim();
    } else if (field === 'genderCode') {
      const gender = value.trim().toLowerCase();
      if (!['male', 'female'].includes(gender)) {
        throw new Error("Пол должен быть 'male' или 'female'");
      }
      profile.genderCode = gender as 'male' | 'female';
    }

    profile.profileCompleteness = ProfilesService.calcCompleteness({
      displayName: profile.displayName,
      bio: profile.bio,
      city: profile.city,
      birthDate: profile.birthDate ?? undefined,
      genderCode: (profile.genderCode ?? undefined) as 'male' | 'female' | undefined,
    });

    return this.profileRepository.save(profile);
  }

  async addPhotoByTelegramFileId(userId: string, telegramFileId: string): Promise<number> {
    const profile = await this.getOrCreateByUserId(userId, 'Пользователь');
    const photosCount = await this.profilePhotosRepository.count({
      where: { profileId: profile.id },
    });
    await this.profilePhotosRepository.save(
      this.profilePhotosRepository.create({
        profileId: profile.id,
        storageBucket: 'telegram',
        storageKey: `telegram/${userId}/${telegramFileId}`,
        contentType: 'image/jpeg',
        sortOrder: photosCount,
      }),
    );
    return photosCount + 1;
  }

  async countPhotos(userId: string): Promise<number> {
    const profile = await this.getByUserId(userId);
    if (!profile) return 0;
    return this.profilePhotosRepository.count({
      where: { profileId: profile.id },
    });
  }
}
