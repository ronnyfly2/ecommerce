import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';
import type { Multer } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BACKOFFICE_ROLES } from '../common/auth/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ConfigService } from '@nestjs/config';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { ChatService } from './chat.service';

function createChatStorage(configService: ConfigService) {
  const uploadDir = `${configService.get<string>('UPLOAD_DIR') || './uploads'}/chat`;
  return diskStorage({
    destination: (_req: Request, _file: Multer.File, cb: (error: Error | null, destination?: string) => void) => {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req: Request, file: Multer.File, cb: (error: Error | null, filename?: string) => void) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const extension = extname(file.originalname || '').toLowerCase();
      cb(null, `${suffix}${extension}`);
    },
  });
}

@ApiTags('Chat')
@ApiBearerAuth()
@Roles(...BACKOFFICE_ROLES)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(@GetUser('id') adminId: string) {
    return this.chatService.getConversations(adminId);
  }

  @Get(':userId/messages')
  getMessages(
    @GetUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.chatService.getMessages(adminId, userId, query);
  }

  @Post(':userId/messages')
  sendMessage(
    @GetUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(adminId, userId, dto.content);
  }

  @Patch(':userId/read')
  markAsRead(
    @GetUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.chatService.markAsRead(adminId, userId);
  }

  @Post(':userId/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createChatStorage(new ConfigService()),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  sendAttachment(
    @GetUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @UploadedFile() file: Multer.File,
  ) {
    return this.chatService.sendAttachmentToUser(adminId, userId, file);
  }

  @Get('groups')
  getGroups(@GetUser('id') adminId: string) {
    return this.chatService.getGroupConversations(adminId);
  }

  @Post('groups')
  createGroup(
    @GetUser('id') adminId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.chatService.createGroup(adminId, dto);
  }

  @Get('groups/:groupId/messages')
  getGroupMessages(
    @GetUser('id') adminId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.chatService.getGroupMessages(adminId, groupId, query);
  }

  @Post('groups/:groupId/messages')
  sendGroupMessage(
    @GetUser('id') adminId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendGroupMessage(adminId, groupId, dto.content);
  }

  @Patch('groups/:groupId/read')
  markGroupAsRead(
    @GetUser('id') adminId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.chatService.markGroupAsRead(adminId, groupId);
  }

  @Post('groups/:groupId/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createChatStorage(new ConfigService()),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  sendGroupAttachment(
    @GetUser('id') adminId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @UploadedFile() file: Multer.File,
  ) {
    return this.chatService.sendGroupAttachment(adminId, groupId, file);
  }
}
