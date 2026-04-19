import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
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

  @ApiPropertyOptional({
    enum: [...Object.values(Role), 'SUPERADMIN_USER'],
    example: 'SUPERADMIN_USER',
  })
  @IsOptional()
  @IsString()
  role?: Role | 'SUPERADMIN_USER';
}
