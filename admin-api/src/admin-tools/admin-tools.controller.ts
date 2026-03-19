import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AdminToolsService } from './admin-tools.service';
import { CleanSeedDto } from './dto/clean-seed.dto';

@ApiTags('Admin Tools')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin-tools')
export class AdminToolsController {
  constructor(private readonly adminToolsService: AdminToolsService) {}

  @Post('seed/run')
  runSeed() {
    return this.adminToolsService.runSeed();
  }

  @Post('seed/clean')
  cleanSeed(@Body() dto: CleanSeedDto, @Req() request: Request) {
    const confirmationHeader = request.headers['x-seed-confirmation'];
    const confirmationFromHeader = Array.isArray(confirmationHeader)
      ? confirmationHeader[0]
      : confirmationHeader;

    return this.adminToolsService.cleanSeed(
      dto,
      confirmationFromHeader ?? dto.confirmationPhrase,
    );
  }
}
