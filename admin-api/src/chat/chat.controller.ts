import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BACKOFFICE_ROLES } from '../common/auth/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';

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
}
