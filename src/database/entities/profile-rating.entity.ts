import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'profile_ratings' })
export class ProfileRatingEntity {
  @PrimaryColumn({ name: 'profile_id', type: 'bigint' })
  profileId!: string;

  @Column({ name: 'primary_score', type: 'numeric', precision: 12, scale: 6, default: 0 })
  primaryScore!: string;

  @Column({ name: 'behavioral_score', type: 'numeric', precision: 12, scale: 6, default: 0 })
  behavioralScore!: string;

  @Column({ name: 'combined_score', type: 'numeric', precision: 12, scale: 6, default: 0 })
  combinedScore!: string;
}
