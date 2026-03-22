import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ORDER_MANAGE_ROLES } from '../common/auth/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @GetUser('id') userId: string,
  ) {
    return this.ordersService.create(dto, userId);
  }

  @Get()
  findAll(
    @GetUser() user: Express.User,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAll(user, query);
  }

  @Get('stats')
  stats(@GetUser() user: Express.User) {
    return this.ordersService.getStats(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Roles(...ORDER_MANAGE_ROLES)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @GetUser('id') actorUserId: string,
  ) {
    return this.ordersService.updateStatus(id, dto, actorUserId);
  }
}
