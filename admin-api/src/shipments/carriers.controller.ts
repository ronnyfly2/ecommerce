import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { UpsertCarrierDto } from './dto/upsert-carrier.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('Shipments - Carriers')
@ApiBearerAuth()
@Controller('carriers')
export class CarriersController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  list() {
    return this.shipmentsService.listCarriers(false);
  }

  @Get('enabled')
  listEnabled() {
    return this.shipmentsService.listCarriers(true);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.shipmentsService.getCarrier(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(@Body() dto: UpsertCarrierDto) {
    return this.shipmentsService.createCarrier(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertCarrierDto) {
    return this.shipmentsService.updateCarrier(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.shipmentsService.deleteCarrier(id);
  }
}
