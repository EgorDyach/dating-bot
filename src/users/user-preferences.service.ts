import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferenceEntity } from '../database/entities/user-preference.entity';
import { RedisService } from '../integrations/redis.service';

type PreferenceField =
  | 'genderPreference'
  | 'cityPreference'
  | 'ageMin'
  | 'ageMax';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectRepository(UserPreferenceEntity)
    private readonly prefRepo: Repository<UserPreferenceEntity>,
    private readonly redisService: RedisService,
  ) {}

  async getPreferences(
    userId: string,
  ): Promise<UserPreferenceEntity | null> {
    return this.prefRepo.findOne({ where: { userId } });
  }

  async updatePreference(
    userId: string,
    field: PreferenceField,
    value: string | number,
  ): Promise<UserPreferenceEntity> {
    let pref = await this.prefRepo.findOne({ where: { userId } });

    if (!pref) {
      pref = this.prefRepo.create({
        userId,
        genderPreference: 'any',
        cityPreference: '',
      });
    }

    // Validate and apply per field
    switch (field) {
      case 'genderPreference':
        if (!['any', 'male', 'female'].includes(String(value))) {
          throw new Error(
            "Неверное предпочтение по полу. Должно быть 'any', 'male' или 'female'",
          );
        }
        pref.genderPreference = String(value) as
          | 'any'
          | 'male'
          | 'female';
        break;

      case 'cityPreference':
        const city = String(value).trim();
        if (city.length > 128) {
          throw new Error('Название города слишком длинное (макс. 128 символов)');
        }
        pref.cityPreference = city;
        break;

      case 'ageMin':
      case 'ageMax':
        const age = parseInt(String(value), 10);
        if (isNaN(age) || age < 18) {
          throw new Error('Возраст должен быть числом >= 18');
        }
        if (field === 'ageMin') {
          if (pref.ageMax && age > pref.ageMax) {
            throw new Error('Минимальный возраст не может быть больше максимального');
          }
          pref.ageMin = age;
        } else {
          if (pref.ageMin && age < pref.ageMin) {
            throw new Error('Максимальный возраст не может быть меньше минимального');
          }
          pref.ageMax = age;
        }
        break;
    }

    await this.prefRepo.save(pref);
    // Clear feed cache to reflect new filters
    await this.redisService.clearFeed(userId);

    return pref;
  }
}
