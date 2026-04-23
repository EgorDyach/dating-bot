import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';

type TelegramUserPayload = {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  private static trunc(value: string | null | undefined, maxLen: number): string {
    if (!value) return '';
    return value.slice(0, maxLen);
  }

  async registerOrUpdateTelegramUser(payload: TelegramUserPayload): Promise<{ isNew: boolean; user: UserEntity }> {
    const existing = await this.usersRepository.findOne({
      where: { telegramId: String(payload.telegramId) },
    });

    const user = this.usersRepository.create({
      id: existing?.id,
      telegramId: String(payload.telegramId),
      username: payload.username ? UsersService.trunc(payload.username.toLowerCase(), 32) : null,
      firstName: UsersService.trunc(payload.firstName, 128),
      lastName: UsersService.trunc(payload.lastName, 128),
      languageCode: payload.languageCode ? UsersService.trunc(payload.languageCode, 16) : null,
    });

    const saved = await this.usersRepository.save(user);
    return { isNew: !existing, user: saved };
  }
}
