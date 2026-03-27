import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasurementUnit } from './entities/measurement-unit.entity';
import { MeasurementUnitsController } from './measurement-units.controller';
import { MeasurementUnitsService } from './measurement-units.service';

@Module({
  imports: [TypeOrmModule.forFeature([MeasurementUnit])],
  controllers: [MeasurementUnitsController],
  providers: [MeasurementUnitsService],
  exports: [MeasurementUnitsService],
})
export class MeasurementUnitsModule {}
