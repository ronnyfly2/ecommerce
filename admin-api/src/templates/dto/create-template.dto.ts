import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsString, Matches } from 'class-validator';
import { TemplateChannel } from '../enums/template-channel.enum';
import { TemplatePageType } from '../enums/template-page-type.enum';

export class CreateTemplateDto {
  @ApiProperty({ example: 'home.main' })
  @IsString()
  @Matches(/^[a-z0-9]+(\.[a-z0-9-]+)+$/)
  templateKey: string;

  @ApiProperty({ enum: TemplateChannel, example: TemplateChannel.WEB })
  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @ApiProperty({ enum: TemplatePageType, example: TemplatePageType.HOME })
  @IsEnum(TemplatePageType)
  pageType: TemplatePageType;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  schemaVersion: string;

  @ApiProperty({ type: Object })
  @IsObject()
  content: Record<string, unknown>;
}
