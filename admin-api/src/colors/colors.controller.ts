import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CATALOG_MANAGE_ROLES,
  CATALOG_READ_ROLES,
} from '../common/auth/role-groups';
import { Roles } from '../common/decorators/roles.decorator';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';

@ApiTags('Colors')
@ApiBearerAuth()
@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateColorDto) {
    return this.colorsService.create(dto);
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get()
  findAll() {
    return this.colorsService.findAll();
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.colorsService.findOne(id);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateColorDto) {
    return this.colorsService.update(id, dto);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.colorsService.remove(id);
  }
}
