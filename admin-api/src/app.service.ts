import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      service: 'admin-api',
      status: 'ok',
      docs: '/api/docs',
    };
  }
}
