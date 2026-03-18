import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RevokeSessionDto {
  @ApiProperty({
    description: 'Identificador de sesion (tokenId) a revocar',
    example: '4bf2d0b4-0f95-4e48-a36d-7272f69f48f7',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  tokenId: string;
}