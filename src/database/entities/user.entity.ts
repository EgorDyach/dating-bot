import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProfileEntity } from './profile.entity';
import { UserPreferenceEntity } from './user-preference.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'telegram_id', type: 'bigint', unique: true })
  telegramId!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  username!: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 128, default: '' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 128, default: '' })
  lastName!: string;

  @Column({ name: 'language_code', type: 'varchar', length: 16, nullable: true })
  languageCode!: string | null;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => ProfileEntity, (profile) => profile.user)
  profile!: ProfileEntity;

  @OneToOne(() => UserPreferenceEntity, (preference) => preference.user)
  preference!: UserPreferenceEntity;
}
