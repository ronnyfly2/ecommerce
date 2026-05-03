import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { SeedTarget } from './seed-target.dto';

export enum SeedCleanMode {
  SEED = 'seed',
  USERS_ALL = 'users-all',
  ALL = 'all',
}

export class CleanSeedDto {
  @ApiPropertyOptional({ enum: SeedCleanMode, default: SeedCleanMode.SEED })
  @IsOptional()
  @IsEnum(SeedCleanMode)
  mode?: SeedCleanMode;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description: 'Required for destructive operations. Must match backend confirmation phrase.',
  })
  @IsOptional()
  @IsString()
  confirmationPhrase?: string;

  @ApiPropertyOptional({
    enum: SeedTarget,
    isArray: true,
    description: 'Optional subset of seed targets when mode=seed.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(SeedTarget, { each: true })
  targets?: SeedTarget[];
}
