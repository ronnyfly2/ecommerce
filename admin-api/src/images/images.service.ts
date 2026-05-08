import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ImagesService {
  buildPublicUrl(request: Request, filename: string) {
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string' ? forwardedProto : request.protocol;
    const host = request.get('host');
    const baseUrl = host ? `${protocol}://${host}` : '';

    return {
      url: `${baseUrl}/uploads/${filename}`,
      filename,
    };
  }
}
