import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MAIL_PROVIDER_TOKEN } from '../notifications.constants';
import type { MailMessage, MailProvider } from '../notifications.types';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailTemplateKey } from './enums/template-key.enum';
import {
  TEMPLATE_REGISTRY,
  type TemplateDefinition,
  getTemplateDefinition,
} from './template-registry';
import { TemplateEngineService } from './template-engine.service';

export type SendTemplateOptions = {
  to: string | string[];
  key: EmailTemplateKey;
  context: Record<string, unknown>;
  subjectOverride?: string;
  throwOnError?: boolean;
};

type ResolvedTemplate = {
  subjectSource: string;
  htmlSource: string;
  isCustom: boolean;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templatesRepository: Repository<EmailTemplate>,
    private readonly engine: TemplateEngineService,
    @Inject(MAIL_PROVIDER_TOKEN)
    private readonly mailProvider: MailProvider,
  ) {}

  async sendTemplate(options: SendTemplateOptions): Promise<void> {
    const def = getTemplateDefinition(options.key);
    const recipients = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to];
    if (recipients.length === 0) {
      this.logger.warn(`Template ${options.key} skipped: no recipients`);
      return;
    }

    const resolved = await this.resolveTemplate(def);
    if (!resolved) {
      this.logger.warn(`Template ${options.key} skipped: disabled or missing`);
      return;
    }

    const rendered = this.engine.render({
      templateSource: resolved.htmlSource,
      subjectSource: options.subjectOverride ?? resolved.subjectSource,
      context: options.context,
    });

    await Promise.all(
      recipients.map((to) => this.deliver({ to, ...rendered }, options.throwOnError ?? false)),
    );
  }

  async renderTemplatePreview(
    key: EmailTemplateKey,
    context?: Record<string, unknown>,
    subjectOverride?: string,
    htmlOverride?: string,
  ): Promise<{ subject: string; html: string; text: string }> {
    const def = getTemplateDefinition(key);
    const resolved = htmlOverride
      ? { htmlSource: htmlOverride, subjectSource: subjectOverride ?? def.defaultSubject, isCustom: true }
      : (await this.resolveTemplate(def)) ?? {
          htmlSource: this.engine.getDefaultTemplateSource(def.defaultFile),
          subjectSource: def.defaultSubject,
          isCustom: false,
        };

    return this.engine.render({
      templateSource: resolved.htmlSource,
      subjectSource: subjectOverride ?? resolved.subjectSource,
      context: context ?? def.sampleContext,
    });
  }

  getDefinition(key: EmailTemplateKey): TemplateDefinition {
    return getTemplateDefinition(key);
  }

  listDefinitions(): TemplateDefinition[] {
    return Object.values(TEMPLATE_REGISTRY);
  }

  async listWithOverrides() {
    const overrides = await this.templatesRepository.find();
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    return this.listDefinitions().map((def) => {
      const override = byKey.get(def.key);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        category: def.category,
        variables: def.variables,
        defaultSubject: def.defaultSubject,
        isCustomized: Boolean(override),
        isEnabled: override?.isEnabled ?? true,
        subject: override?.subject ?? def.defaultSubject,
        updatedAt: override?.updatedAt ?? null,
      };
    });
  }

  async getTemplate(key: EmailTemplateKey) {
    const def = getTemplateDefinition(key);
    const override = await this.templatesRepository.findOne({ where: { key } });
    const defaultHtml = this.engine.getDefaultTemplateSource(def.defaultFile);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      variables: def.variables,
      sampleContext: def.sampleContext,
      defaultSubject: def.defaultSubject,
      defaultHtml,
      subject: override?.subject ?? def.defaultSubject,
      html: override?.html ?? defaultHtml,
      isEnabled: override?.isEnabled ?? true,
      isCustomized: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
    };
  }

  async upsertTemplate(input: {
    key: EmailTemplateKey;
    subject: string;
    html: string;
    isEnabled?: boolean;
    updatedBy?: string | null;
  }) {
    getTemplateDefinition(input.key);
    const existing = await this.templatesRepository.findOne({ where: { key: input.key } });
    const entity = existing ?? this.templatesRepository.create({ key: input.key });
    entity.subject = input.subject;
    entity.html = input.html;
    if (typeof input.isEnabled === 'boolean') entity.isEnabled = input.isEnabled;
    entity.updatedBy = input.updatedBy ?? null;
    await this.templatesRepository.save(entity);
    this.engine.invalidateCache();
    return this.getTemplate(input.key);
  }

  async resetTemplate(key: EmailTemplateKey) {
    getTemplateDefinition(key);
    await this.templatesRepository.delete({ key });
    this.engine.invalidateCache();
    return this.getTemplate(key);
  }

  private async resolveTemplate(def: TemplateDefinition): Promise<ResolvedTemplate | null> {
    const override = await this.templatesRepository.findOne({ where: { key: def.key } });
    if (override) {
      if (!override.isEnabled) return null;
      return { htmlSource: override.html, subjectSource: override.subject, isCustom: true };
    }
    const html = this.engine.getDefaultTemplateSource(def.defaultFile);
    return { htmlSource: html, subjectSource: def.defaultSubject, isCustom: false };
  }

  private async deliver(message: MailMessage, throwOnError: boolean): Promise<void> {
    try {
      await this.mailProvider.send(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Failed to send email "${message.subject}" to ${message.to}: ${msg}`);
      if (throwOnError) throw error;
    }
  }
}
