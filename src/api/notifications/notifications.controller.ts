import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiController } from '../jwt.check.controller'
import { NotificationsService } from './notifications.service'
import {
  BookingReminderDto,
  BulkNotificationDto,
  CreateNotificationDto,
  NotificationFilterDto,
} from './dto'

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController extends ApiController {
  constructor(private readonly notificationsService: NotificationsService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha bildirishnomalar' })
  findAll(@Query() pagination: NotificationFilterDto) {
    return this.notificationsService.findAll(pagination)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta bildirishnoma' })
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Bildirishnoma yuborish (SMS / Telegram)' })
  send(@Body() data: CreateNotificationDto) {
    return this.notificationsService.send(data)
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Ommaviy bildirishnoma yuborish' })
  sendBulk(@Body() dto: BulkNotificationDto) {
    return this.notificationsService.sendBulk(dto)
  }

  @Post('reminder')
  @ApiOperation({ summary: 'Bron eslatmasini yuborish' })
  sendBookingReminder(@Body() dto: BookingReminderDto) {
    return this.notificationsService.sendBookingReminder(dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bildirishnomani o\'chirish' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id)
  }
}
