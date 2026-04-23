import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'interactions' })
@Unique('uq_interactions_pair', ['viewerId', 'viewedId'])
export class InteractionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'viewer_id', type: 'bigint' })
  viewerId!: string;

  @Column({ name: 'viewed_id', type: 'bigint' })
  viewedId!: string;

  @Column({ name: 'action_code', type: 'varchar', length: 16 })
  actionCode!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
