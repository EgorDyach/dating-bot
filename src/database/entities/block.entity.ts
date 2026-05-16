import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Check,
} from 'typeorm';

@Entity({ name: 'blocks' })
@Unique('uq_blocks_pair', ['blockerId', 'blockedId'])
@Check('ck_blocks_distinct', 'blocker_id <> blocked_id')
export class BlockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'blocker_id', type: 'bigint' })
  blockerId!: string;

  @Column({ name: 'blocked_id', type: 'bigint' })
  blockedId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
