import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import type { Multer } from 'multer';
import { Role } from '../common/enums/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { PaymentsService } from './payments.service';

const RECEIPT_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function createReceiptStorage(configService: ConfigService) {
  const uploadDir = configService.get<string>('UPLOAD_DIR') || './uploads';
  return diskStorage({
    destination: (
      _req: Request,
      _file: Multer.File,
      cb: (error: Error | null, destination?: string) => void,
    ) => cb(null, uploadDir),
    filename: (
      _req: Request,
      file: Multer.File,
      cb: (error: Error | null, filename?: string) => void,
    ) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = extname(file.originalname) || '';
      cb(null, `receipt-${suffix}${ext}`);
    },
  });
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('methods')
  @ApiOperation({ summary: 'List enabled payment methods for checkout' })
  listPublicMethods() {
    return this.paymentsService.listMethods(true);
  }

  @Get()
  @ApiOperation({ summary: 'List payments (filtered by user unless backoffice)' })
  findAll(@Query() query: QueryPaymentsDto, @GetUser() user: Express.User) {
    return this.paymentsService.findAll(query, user);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto, @GetUser() user: Express.User) {
    return this.paymentsService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: Express.User) {
    return this.paymentsService.findOne(id, user);
  }

  @Post(':id/receipt')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        receipt: { type: 'string', format: 'binary' },
      },
      required: ['receipt'],
    },
  })
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: createReceiptStorage(new ConfigService()),
      fileFilter: (
        _req: Request,
        file: Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => cb(null, RECEIPT_MIME_ALLOWLIST.has(file.mimetype)),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File | undefined,
    @GetUser() user: Express.User,
  ) {
    if (!file) {
      throw new BadRequestException('receipt file is required (image or pdf, <= 10MB)');
    }
    return this.paymentsService.uploadReceipt(
      id,
      {
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
      user,
    );
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @GetUser() user: Express.User) {
    return this.paymentsService.cancel(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SALES, Role.BOSS)
  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewPaymentDto,
    @GetUser('id') reviewerId: string,
  ) {
    return this.paymentsService.review(id, dto, reviewerId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/refund')
  refund(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @GetUser('id') reviewerId: string,
  ) {
    return this.paymentsService.refund(id, reviewerId, body?.reason);
  }
}
