import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'user_preferences' })
export class UserPreferenceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'age_min', type: 'smallint', nullable: true })
  ageMin!: number | null;

  @Column({ name: 'age_max', type: 'smallint', nullable: true })
  ageMax!: number | null;

  @Column({ name: 'gender_preference', type: 'varchar', length: 16, default: 'any' })
  genderPreference!: string;

  @Column({ name: 'city_preference', type: 'varchar', length: 128, default: '' })
  cityPreference!: string;

  @Column({ name: 'max_distance_km', type: 'smallint', nullable: true })
  maxDistanceKm!: number | null;

  @OneToOne(() => UserEntity, (user) => user.preference, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
