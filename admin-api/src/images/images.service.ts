import { Injectable } from '@nestjs/common';

@Injectable()
export class ImagesService {
  buildPublicUrl(filename: string) {
    return {
      url: `/uploads/${filename}`,
      filename,
    };
  }
}
