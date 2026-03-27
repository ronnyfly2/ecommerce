import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BACKOFFICE_ROLES } from '../common/auth/role-groups';
import { User } from '../users/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Cualquier cliente autenticado puede dejar una review
  @Roles(Role.CUSTOMER, ...BACKOFFICE_ROLES)
  @Post()
  @ApiOperation({ summary: 'Crear review para un producto (1 por usuario)' })
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
    @GetUser('id') userId: string,
  ) {
    return this.reviewsService.create(productId, dto, userId);
  }

  // Backoffice lee todas (con filtro isApproved); público ve solo aprobadas
  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar reviews de un producto' })
  findAll(
    @Param('productId') productId: string,
    @Query() query: QueryReviewsDto,
  ) {
    // Por defecto públicamente solo se ven las aprobadas
    const normalizedQuery: QueryReviewsDto = {
      ...query,
      isApproved: query.isApproved ?? true,
    };
    return this.reviewsService.findAllByProduct(productId, normalizedQuery);
  }

  // Backoffice puede ver estadísticas del producto
  @Roles(...BACKOFFICE_ROLES)
  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas de reviews de un producto (admin)' })
  stats(@Param('productId') productId: string) {
    return this.reviewsService.getProductStats(productId);
  }

  // Backoffice ve todas las reviews sin filtro de aprobación
  @Roles(...BACKOFFICE_ROLES)
  @Get('all')
  @ApiOperation({ summary: 'Listar todas las reviews incluyendo no aprobadas (admin)' })
  findAllAdmin(
    @Param('productId') productId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.findAllByProduct(productId, query);
  }

  @Roles(Role.CUSTOMER, ...BACKOFFICE_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Roles(Role.CUSTOMER, ...BACKOFFICE_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar review propia o aprobar como admin' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @GetUser() user: Pick<User, 'id' | 'role'>,
  ) {
    return this.reviewsService.update(id, dto, user);
  }

  @Roles(Role.CUSTOMER, ...BACKOFFICE_ROLES)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar review propia o como admin' })
  remove(
    @Param('id') id: string,
    @GetUser() user: Pick<User, 'id' | 'role'>,
  ) {
    return this.reviewsService.remove(id, user);
  }
}
