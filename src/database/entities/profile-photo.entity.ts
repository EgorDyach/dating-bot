import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'profile_photos' })
export class ProfilePhotoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'profile_id', type: 'bigint' })
  profileId!: string;

  @Column({ name: 'storage_bucket', type: 'varchar', length: 64, default: 'profiles' })
  storageBucket!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128, default: 'image/jpeg' })
  contentType!: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
