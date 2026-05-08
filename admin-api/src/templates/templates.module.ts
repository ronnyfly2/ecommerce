import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { TemplatesAdminController } from './templates.admin.controller';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Template]), JwtModule.register({})],
  controllers: [TemplatesController, TemplatesAdminController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
