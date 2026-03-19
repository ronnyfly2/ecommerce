import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import type { Multer } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ImagesService } from './images.service';

// Factory function for typed multer storage
function createImageStorage(configService: ConfigService) {
  const uploadDir = configService.get<string>('UPLOAD_DIR') || './uploads';
  
  return diskStorage({
    destination: (_req: Request, _file: Multer.File, cb: (error: Error | null, destination?: string) => void) => {
      cb(null, uploadDir);
    },
    filename: (_req: Request, file: Multer.File, cb: (error: Error | null, filename?: string) => void) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const extension = extname(file.originalname);
      cb(null, `${suffix}${extension}`);
    },
  });
}

@ApiTags('Images')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['image'],
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: createImageStorage(new ConfigService()),
      fileFilter: (_req: Request, file: Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        const isImage = file.mimetype.startsWith('image/');
        cb(null, isImage);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  upload(@UploadedFile() file: Multer.File) {
    return this.imagesService.buildPublicUrl(file.filename);
  }
}
