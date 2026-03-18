import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();

    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      email,
      passwordHash,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      role: dto.role ?? Role.ADMIN,
      isActive: true,
    });

    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  async findAll(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> | FindOptionsWhere<User>[] = this.buildWhere(query);

    const [items, total] = await this.usersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((user) => this.sanitize(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email) {
      const email = dto.email.toLowerCase();
      const exists = await this.usersRepository.findOne({ where: { email } });
      if (exists && exists.id !== user.id) {
        throw new ConflictException('Email already in use');
      }
      user.email = email;
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName ?? null;
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName ?? null;
    }

    if (dto.role) {
      user.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    const updated = await this.usersRepository.save(user);
    return this.sanitize(updated);
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.delete(id);
    return { deleted: true };
  }

  private buildWhere(query: QueryUsersDto): FindOptionsWhere<User> | FindOptionsWhere<User>[] {
    const base: FindOptionsWhere<User> = {};

    if (query.role) {
      base.role = query.role;
    }

    if (query.isActive !== undefined) {
      base.isActive = query.isActive;
    }

    if (query.search) {
      return [
        { ...base, email: ILike(`%${query.search}%`) },
        { ...base, firstName: ILike(`%${query.search}%`) },
        { ...base, lastName: ILike(`%${query.search}%`) },
      ];
    }

    return base;
  }

  private sanitize(user: User) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
