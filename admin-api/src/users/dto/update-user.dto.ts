import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { CreateUserDto } from './create-user.dto';
import { ALL_PERMISSION_KEYS, PermissionKey } from '../../common/auth/permissions';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ minLength: 8, example: 'newsecret123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: Role,
    isArray: true,
    description: 'Roles delegados para permisos adicionales',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  grantedRoles?: Role[];

  @ApiPropertyOptional({
    enum: ALL_PERMISSION_KEYS,
    isArray: true,
    description: 'Permisos CRUD por recurso (solo asignables por SUPER_ADMIN)',
  })
  @IsOptional()
  @IsArray()
  @IsIn(ALL_PERMISSION_KEYS, { each: true })
  grantedPermissions?: PermissionKey[];
}
