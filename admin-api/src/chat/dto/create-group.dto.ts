import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Soporte VIP' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    type: [String],
    example: ['a0ab1f42-f5ce-4c84-abce-19dca3672db9'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds: string[];
}
