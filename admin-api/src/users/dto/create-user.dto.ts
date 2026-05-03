import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { ALL_PERMISSION_KEYS, PermissionKey } from '../../common/auth/permissions';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@tienda.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'supersecret123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Ronny' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Lopez' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.ADMIN })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

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
