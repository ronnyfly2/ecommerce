import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AddShipmentEventDto } from './dto/add-event.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-status.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('Shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List shipments (filtered by user unless backoffice)' })
  findAll(@Query() query: QueryShipmentsDto, @GetUser() user: Express.User) {
    return this.shipmentsService.findAll(query, user);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'List shipments belonging to an order' })
  findByOrder(@Param('orderId') orderId: string, @GetUser() user: Express.User) {
    return this.shipmentsService.findByOrder(orderId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: Express.User) {
    return this.shipmentsService.findOne(id, user);
  }

  @Get(':id/events')
  listEvents(@Param('id') id: string, @GetUser() user: Express.User) {
    return this.shipmentsService.listEvents(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.SALES)
  @Post()
  create(@Body() dto: CreateShipmentDto, @GetUser() user: Express.User) {
    return this.shipmentsService.create(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.SALES)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @GetUser() user: Express.User,
  ) {
    return this.shipmentsService.update(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.SALES)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
    @GetUser() user: Express.User,
  ) {
    return this.shipmentsService.updateStatus(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.SALES)
  @Post(':id/events')
  addEvent(
    @Param('id') id: string,
    @Body() dto: AddShipmentEventDto,
    @GetUser() user: Express.User,
  ) {
    return this.shipmentsService.addEvent(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: Express.User) {
    await this.shipmentsService.remove(id, user);
  }
}
