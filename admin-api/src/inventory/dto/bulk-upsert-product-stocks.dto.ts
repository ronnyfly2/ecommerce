import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { UpsertProductStockDto } from './upsert-product-stock.dto';

class BulkUpsertProductStockItemDto extends UpsertProductStockDto {
  @ApiProperty({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsUUID()
  productId: string;
}

export class BulkUpsertProductStocksDto {
  @ApiProperty({ type: [BulkUpsertProductStockItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertProductStockItemDto)
  items: BulkUpsertProductStockItemDto[];
}
