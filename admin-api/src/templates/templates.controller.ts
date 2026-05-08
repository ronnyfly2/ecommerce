import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { QueryTemplatePreviewDto } from './dto/query-template-preview.dto';
import { QueryTemplateDto } from './dto/query-template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Public()
  @Get('preview/:id')
  findPreviewById(@Param('id') id: string, @Query() query: QueryTemplatePreviewDto) {
    return this.templatesService.findPreviewByIdWithToken(id, query.token);
  }

  @Public()
  @Get(':templateKey')
  findPublished(
    @Param('templateKey') templateKey: string,
    @Query() query: QueryTemplateDto,
  ) {
    return this.templatesService.findPublishedByTemplateKey(templateKey, query);
  }
}
