import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { SeedTarget } from './seed-target.dto';

export { SeedTarget as SeedRunTarget };

export class RunSeedDto {
  @ApiPropertyOptional({
    enum: SeedTarget,
    isArray: true,
    description: 'Subset of seed targets to execute. When omitted, runs the full segmented seed.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(SeedTarget, { each: true })
  targets?: SeedTarget[];
}