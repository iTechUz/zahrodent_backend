import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { PaginationDto } from 'src/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { NotificationsService } from './notifications.service'
import { NotificationsCreateDto } from './dto'
@ApiTags('Branch')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')

export class NotificationsController extends ApiController {
	constructor(private readonly notificationsService: NotificationsService){
		super()
	}

	@Get()
	async getAllNotifications(@Query() pagination: PaginationDto) {
		return this.notificationsService.findAll(pagination)
	}
	@Get(':id')
	async getNotificationById(@Param('id') id: string) {
		return this.notificationsService.findOne(id)
	}

	@Post()
	async createNotification(@Body() data: NotificationsCreateDto) {
		return this.notificationsService.create(data)
	}

	@Put(':id')
	async updateNotification(@Param('id') id: string, @Body() data: NotificationsCreateDto) {
		return this.notificationsService.update(id, data)
	}

	@Delete(':id')
	async deleteNotification(@Param('id') id: string) {
		return this.notificationsService.remove(id)
	}
}
