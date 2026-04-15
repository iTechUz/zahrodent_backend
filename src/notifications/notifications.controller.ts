import { Body, Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RecipientQueryDto, BulkSendDto } from './dto/bulk-sms.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'receptionist')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirishnomalar tarixi' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Bitta bildirishnoma yaratish' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('send-reminders')
  @ApiOperation({
    summary: 'Eslatmalar yuborish',
    description:
      'pending va confirmed qabullar uchun avtomatik xabar yaratish (frontend dagi tugma bilan bir xil)',
  })
  @ApiOkResponse({
    description: 'Yaratilgan yozuvlar soni',
    schema: {
      type: 'object',
      properties: { created: { type: 'number', example: 5 } },
    },
  })
  sendReminders() {
    return this.notificationsService.sendReminders();
  }

  @Get('recipients')
  @ApiOperation({ summary: 'SMS yuborish mumkin bo\'lgan mijozlar ro\'yxati' })
  findRecipients(@Query() query: RecipientQueryDto) {
    return this.notificationsService.findRecipients(query);
  }

  @Post('bulk-send')
  @ApiOperation({ summary: 'Tanlangan mijozlarga ommaviy SMS yuborish' })
  bulkSend(@Body() dto: BulkSendDto) {
    return this.notificationsService.bulkSend(dto);
  }
}
