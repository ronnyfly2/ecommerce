import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 'Actualicé mi opinion, sigue siendo bueno.' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: true, description: 'Solo admin puede aprobar' })
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
