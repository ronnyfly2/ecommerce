import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import * as path from 'path';

export type RenderInput = {
  templateSource: string;
  subjectSource: string;
  context: Record<string, unknown>;
};

export type RenderOutput = {
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class TemplateEngineService implements OnModuleInit {
  private readonly logger = new Logger(TemplateEngineService.name);
  private readonly handlebars = Handlebars.create();
  private readonly compileCache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly defaultsDir = this.resolveDefaultsDir();
  private readonly partialsDir = path.join(this.defaultsDir, 'partials');

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.registerHelpers();
    await this.registerPartials();
  }

  getDefaultTemplateSource(filename: string): string {
    const filePath = path.join(this.defaultsDir, filename);
    return fs.readFileSync(filePath, 'utf8');
  }

  render({ templateSource, subjectSource, context }: RenderInput): RenderOutput {
    const globals = this.buildGlobalContext();
    const merged = { ...globals, ...context };

    const html = this.compileAndRun(templateSource, merged);
    const subject = this.compileAndRun(subjectSource, merged).trim();
    const text = this.htmlToPlainText(html);

    return { subject, html, text };
  }

  invalidateCache(): void {
    this.compileCache.clear();
  }

  private compileAndRun(source: string, context: Record<string, unknown>): string {
    const cached = this.compileCache.get(source);
    const template = cached ?? this.handlebars.compile(source, { noEscape: false, strict: false });
    if (!cached) {
      this.compileCache.set(source, template);
    }
    return template(context);
  }

  private buildGlobalContext(): Record<string, unknown> {
    const appUrl = this.configService.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const appName = this.configService.get<string>('APP_NAME')?.trim() || 'Ecommerce';
    return {
      appUrl,
      appName,
      currentYear: new Date().getFullYear(),
    };
  }

  private registerHelpers(): void {
    const hb = this.handlebars;

    hb.registerHelper('formatCurrency', (value: unknown, currency?: unknown) => {
      const numeric = Number(value ?? 0);
      const code = typeof currency === 'string' && currency ? currency : 'USD';
      try {
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: code,
          minimumFractionDigits: 2,
        }).format(numeric);
      } catch {
        return `${numeric.toFixed(2)} ${code}`;
      }
    });

    hb.registerHelper('formatDate', (value: unknown) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    });

    hb.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    hb.registerHelper('gt', (a: unknown, b: unknown) => Number(a) > Number(b));
    hb.registerHelper('lt', (a: unknown, b: unknown) => Number(a) < Number(b));
    hb.registerHelper('upper', (value: unknown) => String(value ?? '').toUpperCase());
  }

  private resolveDefaultsDir(): string {
    const candidates = [
      path.join(__dirname, 'defaults'),
      path.join(process.cwd(), 'dist', 'src', 'notifications', 'templates', 'defaults'),
      path.join(process.cwd(), 'dist', 'notifications', 'templates', 'defaults'),
      path.join(process.cwd(), 'src', 'notifications', 'templates', 'defaults'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private async registerPartials(): Promise<void> {
    if (!fs.existsSync(this.partialsDir)) {
      this.logger.warn(`Partials directory not found: ${this.partialsDir}`);
      return;
    }

    const files = fs.readdirSync(this.partialsDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      const name = path.basename(file, '.hbs');
      const source = fs.readFileSync(path.join(this.partialsDir, file), 'utf8');
      this.handlebars.registerPartial(name, source);
    }
  }

  private htmlToPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
