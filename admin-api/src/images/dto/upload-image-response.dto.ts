import { ApiProperty } from '@nestjs/swagger';

export class UploadImageResponseDto {
  @ApiProperty({ example: '/uploads/products/1710700000000-123456.png' })
  url: string;

  @ApiProperty({ example: '1710700000000-123456.png' })
  filename: string;
}
