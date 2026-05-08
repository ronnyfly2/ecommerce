import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CATALOG_MANAGE_ROLES } from '../common/auth/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PublishTemplateDto } from './dto/publish-template.dto';
import { QueryAdminTemplatesDto } from './dto/query-admin-templates.dto';
import { RollbackTemplateDto } from './dto/rollback-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Templates Admin')
@ApiBearerAuth()
@Controller('admin/templates')
export class TemplatesAdminController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Roles(...CATALOG_MANAGE_ROLES)
  @Get()
  list(@Query() query: QueryAdminTemplatesDto) {
    return this.templatesService.listForAdmin(query);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findByIdForAdmin(id);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post()
  createDraft(@Body() dto: CreateTemplateDto, @GetUser('id') userId: string) {
    return this.templatesService.createDraft(dto, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Put(':id')
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @GetUser('id') userId: string,
  ) {
    return this.templatesService.updateDraft(id, dto, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() dto: PublishTemplateDto,
    @GetUser('id') userId: string,
  ) {
    return this.templatesService.publish(id, dto, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post(':id/deprecate')
  deprecate(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.templatesService.deprecate(id, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post(':id/rollback')
  rollback(
    @Param('id') id: string,
    @Body() dto: RollbackTemplateDto,
    @GetUser('id') userId: string,
  ) {
    return this.templatesService.rollback(id, dto, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post(':id/preview-token')
  createPreviewToken(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.templatesService.createPreviewToken(id, userId);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
