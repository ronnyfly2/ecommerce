import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TemplateChannel } from '../enums/template-channel.enum';
import { TemplatePageType } from '../enums/template-page-type.enum';
import { TemplateStatus } from '../enums/template-status.enum';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_key', type: 'varchar', length: 120 })
  templateKey: string;

  @Column({ type: 'varchar', length: 20 })
  channel: TemplateChannel;

  @Column({ name: 'page_type', type: 'varchar', length: 40 })
  pageType: TemplatePageType;

  @Column({ type: 'int', default: 0 })
  version: number;

  @Column({ type: 'varchar', length: 20, default: TemplateStatus.DRAFT })
  status: TemplateStatus;

  @Column({ name: 'schema_version', type: 'varchar', length: 20 })
  schemaVersion: string;

  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  @Column({ name: 'publish_note', type: 'text', nullable: true })
  publishNote: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 120, nullable: true })
  updatedBy: string | null;

  @Column({ name: 'published_by', type: 'varchar', length: 120, nullable: true })
  publishedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
