import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common'
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AdminService } from './admin.service'

import { RequirePermission } from '@/decorators/permissions.decorator'
import { CurrentUser } from '@/decorators/user.decorator'
import { PaginationDto } from '@/utils/paginations'
import { User } from '@prisma/client'
import { RolesEnum } from 'src/constantis'
import { RolesD } from 'src/decorators/role.decorator'
import { ApiController } from '../jwt.check.controller'
import { CreateAdminDto, UpdateAdminDto } from './dto'
@ApiTags('Admin')
@RolesD(RolesEnum.SUPER_ADMIN)
@Controller('admin')
export class AdminController extends ApiController {
	@Inject() private readonly adminService: AdminService

	@Get()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiQuery({ type: PaginationDto })
	@RequirePermission('read')
	async findAll(@Query() query: PaginationDto, @CurrentUser() user: User) {
		return await this.adminService.findAll(query, user)
	}

	@Get(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	findOne(@Param('id') id: string, @CurrentUser() user: User) {
		return this.adminService.findOne(id, user)
	}
	@Post()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	create(@Body() dto: CreateAdminDto, @CurrentUser() user: User) {
		return this.adminService.create(dto, user)
	}

	@Put(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	update(
		@Param('id') id: string,
		@Body() dto: UpdateAdminDto,
		@CurrentUser() user: User
	) {
		return this.adminService.update(id, dto, user)
	}

	@Delete(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	remove(@Param('id') id: string, @CurrentUser() user: User) {
		return this.adminService.remove(id, user)
	}
}
