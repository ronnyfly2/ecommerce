import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  INVENTORY_MANAGE_ROLES,
  INVENTORY_READ_ROLES,
} from '../common/auth/role-groups';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { QueryInventoryMovementsDto } from './dto/query-inventory-movements.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Post('adjustment')
  adjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.createMovement(dto, userId);
  }

  @Roles(...INVENTORY_READ_ROLES)
  @Get('movements')
  movements(@Query() query: QueryInventoryMovementsDto) {
    return this.inventoryService.findMovements(query);
  }
}
