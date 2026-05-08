import { Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AdminToolsService } from './admin-tools.service';
import { SavePdfDraftDto } from './dto/save-pdf-draft.dto';

@ApiTags('Admin Tools')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS)
@Controller('admin-tools/pdf-drafts')
export class AdminToolsPdfDraftsController {
  constructor(private readonly adminToolsService: AdminToolsService) {}

  @Put()
  saveDraft(@GetUser('id') userId: string, @Body() dto: SavePdfDraftDto) {
    return this.adminToolsService.savePdfDraft(userId, dto);
  }

  @Get()
  getDraft(@GetUser('id') userId: string, @Query('key') documentKey: string) {
    return this.adminToolsService.getPdfDraft(userId, documentKey);
  }

  @Delete()
  deleteDraft(@GetUser('id') userId: string, @Query('key') documentKey: string) {
    return this.adminToolsService.deletePdfDraft(userId, documentKey);
  }
}
