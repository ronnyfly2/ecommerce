import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { TestSendEmailTemplateDto } from './dto/test-send-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { EmailTemplateKey } from './enums/template-key.enum';
import { MailService } from './mail.service';

const KEY_VALUES = Object.values(EmailTemplateKey) as string[];

@ApiTags('Email Templates')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETING)
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  async list() {
    return this.mailService.listWithOverrides();
  }

  @Get(':key')
  async getOne(@Param('key') key: string) {
    const enumKey = this.assertKey(key);
    return this.mailService.getTemplate(enumKey);
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateEmailTemplateDto,
    @GetUser('id') userId: string,
  ) {
    const enumKey = this.assertKey(key);
    return this.mailService.upsertTemplate({
      key: enumKey,
      subject: dto.subject,
      html: dto.html,
      isEnabled: dto.isEnabled,
      updatedBy: userId,
    });
  }

  @Post(':key/reset')
  async reset(@Param('key') key: string) {
    const enumKey = this.assertKey(key);
    return this.mailService.resetTemplate(enumKey);
  }

  @Post(':key/preview')
  async preview(@Param('key') key: string, @Body() dto: PreviewEmailTemplateDto) {
    const enumKey = this.assertKey(key);
    return this.mailService.renderTemplatePreview(enumKey, dto.context, dto.subject, dto.html);
  }

  @Post(':key/test-send')
  async testSend(@Param('key') key: string, @Body() dto: TestSendEmailTemplateDto) {
    const enumKey = this.assertKey(key);
    const def = this.mailService.getDefinition(enumKey);
    const rendered = await this.mailService.renderTemplatePreview(
      enumKey,
      dto.context ?? def.sampleContext,
      dto.subject,
      dto.html,
    );
    await this.mailService.sendTemplate({
      to: dto.to,
      key: enumKey,
      context: dto.context ?? def.sampleContext,
      subjectOverride: dto.subject,
      throwOnError: true,
    });
    return { ok: true, subject: rendered.subject };
  }

  private assertKey(key: string): EmailTemplateKey {
    if (!KEY_VALUES.includes(key)) {
      throw new NotFoundException(`Template ${key} no existe`);
    }
    return key as EmailTemplateKey;
  }
}
