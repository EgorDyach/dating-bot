import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'profiles' })
export class ProfileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unique: true })
  userId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 64 })
  displayName!: string;

  @Column({ type: 'varchar', length: 2000, default: '' })
  bio!: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'gender_code', type: 'varchar', length: 16, nullable: true })
  genderCode!: string | null;

  @Column({ type: 'varchar', length: 128, default: '' })
  city!: string;

  @Column({ name: 'profile_completeness', type: 'smallint', default: 0 })
  profileCompleteness!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_visible_in_feed', type: 'boolean', default: true })
  isVisibleInFeed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserEntity, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
