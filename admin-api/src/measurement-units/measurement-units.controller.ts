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
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { MeasurementUnitsService } from './measurement-units.service';

@ApiTags('Measurement Units')
@ApiBearerAuth()
@Controller('measurement-units')
export class MeasurementUnitsController {
  constructor(private readonly measurementUnitsService: MeasurementUnitsService) {}

  @Roles(...CATALOG_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateMeasurementUnitDto) {
    return this.measurementUnitsService.create(dto);
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get()
  findAll() {
    return this.measurementUnitsService.findAll();
  }

  @Roles(...CATALOG_READ_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.measurementUnitsService.findOne(id);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMeasurementUnitDto) {
    return this.measurementUnitsService.update(id, dto);
  }

  @Roles(...CATALOG_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.measurementUnitsService.remove(id);
  }
}
