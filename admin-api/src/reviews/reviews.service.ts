import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ProductReview } from './entities/product-review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewsRepository: Repository<ProductReview>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(productId: string, dto: CreateReviewDto, userId: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new BadRequestException('User must have a registered email to leave a review');
    }

    const existing = await this.reviewsRepository.findOne({
      where: { product: { id: productId }, user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const review = this.reviewsRepository.create({
      product,
      user,
      rating: dto.rating,
      comment: dto.comment?.trim() ?? null,
      isApproved: false,
    });

    return this.reviewsRepository.save(review);
  }

  async findAllByProduct(productId: string, query: QueryReviewsDto) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.product_id = :productId', { productId })
      .orderBy('review.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.isApproved !== undefined) {
      qb.andWhere('review.is_approved = :isApproved', { isApproved: query.isApproved });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((r) => this.mapReview(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const review = await this.reviewsRepository.findOne({
      where: { id },
      relations: { user: true, product: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return this.mapReview(review);
  }

  async update(
    id: string,
    dto: UpdateReviewDto,
    requestUser: Pick<User, 'id' | 'role'>,
  ) {
    const review = await this.reviewsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const isAdmin = this.isAdminRole(requestUser.role);
    const isOwner = review.user.id === requestUser.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    if (!isAdmin && dto.isApproved !== undefined) {
      throw new ForbiddenException('Only admins can approve reviews');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment?.trim() ?? null;
    if (isAdmin && dto.isApproved !== undefined) review.isApproved = dto.isApproved;

    return this.reviewsRepository.save(review);
  }

  async remove(id: string, requestUser: Pick<User, 'id' | 'role'>) {
    const review = await this.reviewsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const isAdmin = this.isAdminRole(requestUser.role);
    const isOwner = review.user.id === requestUser.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewsRepository.delete(id);
    return { deleted: true };
  }

  async getProductStats(productId: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const result = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'total')
      .addSelect('AVG(review.rating)', 'average')
      .addSelect('SUM(CASE WHEN review.rating = 1 THEN 1 ELSE 0 END)', 'stars1')
      .addSelect('SUM(CASE WHEN review.rating = 2 THEN 1 ELSE 0 END)', 'stars2')
      .addSelect('SUM(CASE WHEN review.rating = 3 THEN 1 ELSE 0 END)', 'stars3')
      .addSelect('SUM(CASE WHEN review.rating = 4 THEN 1 ELSE 0 END)', 'stars4')
      .addSelect('SUM(CASE WHEN review.rating = 5 THEN 1 ELSE 0 END)', 'stars5')
      .where('review.product_id = :productId', { productId })
      .andWhere('review.is_approved = true')
      .getRawOne();

    return {
      total: Number(result?.total ?? 0),
      average: result?.average ? Number(Number(result.average).toFixed(1)) : null,
      distribution: {
        1: Number(result?.stars1 ?? 0),
        2: Number(result?.stars2 ?? 0),
        3: Number(result?.stars3 ?? 0),
        4: Number(result?.stars4 ?? 0),
        5: Number(result?.stars5 ?? 0),
      },
    };
  }

  private mapReview(review: ProductReview) {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.user
        ? {
            id: review.user.id,
            email: review.user.email,
            firstName: review.user.firstName,
            lastName: review.user.lastName,
          }
        : null,
    };
  }

  private isAdminRole(role: Role): boolean {
    return [Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.MARKETING, Role.SALES].includes(role);
  }
}
