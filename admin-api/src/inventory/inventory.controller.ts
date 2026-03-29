import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
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
import { UpsertProductStockDto } from './dto/upsert-product-stock.dto';
import { QueryProductStocksDto } from './dto/query-product-stocks.dto';
import { BulkUpsertProductStocksDto } from './dto/bulk-upsert-product-stocks.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
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

  @Roles(...INVENTORY_READ_ROLES)
  @Get('stores')
  stores() {
    return this.inventoryService.listStores();
  }

  @Roles(...INVENTORY_READ_ROLES)
  @Get('products/:productId/stock')
  productStock(@Param('productId') productId: string) {
    return this.inventoryService.getProductStock(productId);
  }

  @Roles(...INVENTORY_READ_ROLES)
  @Get('stocks')
  productStocks(@Query() query: QueryProductStocksDto) {
    return this.inventoryService.listProductStocks(query);
  }

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Put('products/:productId/stock')
  upsertProductStock(
    @Param('productId') productId: string,
    @Body() dto: UpsertProductStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.upsertProductStock(productId, dto, userId);
  }

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Put('stocks/bulk')
  bulkUpsertProductStocks(
    @Body() dto: BulkUpsertProductStocksDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.bulkUpsertProductStocks(dto, userId);
  }

  // ── Stores CRUD ───────────────────────────────────────────────

  @Roles(...INVENTORY_READ_ROLES)
  @Get('stores/all')
  allStores() {
    return this.inventoryService.allStores();
  }

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Post('stores')
  createStore(@Body() dto: CreateStoreDto) {
    return this.inventoryService.createStore(dto);
  }

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Patch('stores/:id')
  updateStore(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.inventoryService.updateStore(id, dto);
  }

  @Roles(...INVENTORY_MANAGE_ROLES)
  @Delete('stores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStore(@Param('id') id: string) {
    return this.inventoryService.deleteStore(id);
  }
}
