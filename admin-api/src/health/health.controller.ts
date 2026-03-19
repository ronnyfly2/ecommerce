import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Public()
  @Get()
  async check() {
    const dbOk = this.dataSource.isInitialized;

    if (!dbOk) {
      return {
        status: 'error',
        db: 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      db: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
