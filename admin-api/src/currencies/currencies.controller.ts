import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CURRENCY_MANAGE_ROLES,
  CURRENCY_READ_ROLES,
} from '../common/auth/role-groups';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@ApiTags('Currencies')
@ApiBearerAuth()
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Roles(...CURRENCY_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currenciesService.create(dto);
  }

  @Roles(...CURRENCY_READ_ROLES)
  @Get()
  findAll() {
    return this.currenciesService.findAll();
  }

  @Roles(...CURRENCY_READ_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(id);
  }

  @Roles(...CURRENCY_MANAGE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currenciesService.update(id, dto);
  }

  @Roles(...CURRENCY_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.currenciesService.remove(id);
  }
}
