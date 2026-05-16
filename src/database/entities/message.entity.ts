import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'messages' })
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'match_id', type: 'bigint' })
  matchId!: string;

  @Column({ name: 'sender_id', type: 'bigint' })
  senderId!: string;

  @Column({ type: 'varchar', length: 4096 })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
