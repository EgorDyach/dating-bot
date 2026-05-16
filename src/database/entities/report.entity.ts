import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Check,
} from 'typeorm';

@Entity({ name: 'reports' })
@Check('ck_reports_distinct', 'reporter_id <> reported_id')
@Check('ck_reports_reason', "reason_code IN ('spam', 'inappropriate', 'fake')")
export class ReportEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'reporter_id', type: 'bigint' })
  reporterId!: string;

  @Column({ name: 'reported_id', type: 'bigint' })
  reportedId!: string;

  @Column({ name: 'reason_code', type: 'varchar', length: 32 })
  reasonCode!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
