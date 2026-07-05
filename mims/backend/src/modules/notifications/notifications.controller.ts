import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateDirectNotificationDto } from './dto/create-direct-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Request() req, @Query('unreadOnly') unreadOnly?: string, @Query('limit') limit?: string) {
    return this.service.list(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@Request() req) {
    return this.service.unreadCount(req.user.id);
  }

  // Hospital users the caller can send a direct notification to (any role).
  // hospitalId is honoured only for super admins; everyone else is locked to
  // their own hospital server-side.
  @Get('recipients')
  recipients(@Request() req, @Query('hospitalId') hospitalId?: string) {
    return this.service.listRecipients(req.user, hospitalId);
  }

  // Any logged-in user can send a direct notification to a specific user.
  @Post()
  createDirect(@Body() dto: CreateDirectNotificationDto, @Request() req) {
    return this.service.createDirect(req.user, dto);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Request() req) {
    return this.service.markRead(id, req.user.id);
  }

  @Post('read-all')
  markAllRead(@Request() req) {
    return this.service.markAllRead(req.user.id);
  }
}
