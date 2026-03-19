import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

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
}
