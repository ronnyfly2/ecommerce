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
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { SizesService } from './sizes.service';

@ApiTags('Sizes')
@ApiBearerAuth()
@Controller('sizes')
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateSizeDto) {
    return this.sizesService.create(dto);
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get()
  findAll() {
    return this.sizesService.findAll();
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sizesService.findOne(id);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSizeDto) {
    return this.sizesService.update(id, dto);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sizesService.remove(id);
  }
}
