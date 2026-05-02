import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { UpsertPaymentMethodDto } from './dto/upsert-payment-method.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments - Methods')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list() {
    return this.paymentsService.listMethods(false);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.paymentsService.getMethod(id);
  }

  @Post()
  create(@Body() dto: UpsertPaymentMethodDto) {
    return this.paymentsService.createMethod(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPaymentMethodDto) {
    return this.paymentsService.updateMethod(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.paymentsService.deleteMethod(id);
  }
}
