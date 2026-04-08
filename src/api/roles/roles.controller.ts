import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	Put,
	Query
} from '@nestjs/common'
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RoleCreateDto, RoleUpdateDto } from './dto'

import { RequirePermission } from '@/decorators/permissions.decorator'
import { CurrentUser } from '@/decorators/user.decorator'
import { PaginationDto } from '@/utils/paginations'
import { User } from '@prisma/client'
import { RolesEnum } from 'src/constantis'
import { RolesD } from 'src/decorators/role.decorator'
import { ApiController } from '../jwt.check.controller'
import { RolesService } from './roles.service'

@ApiTags('Roles')
@RolesD(RolesEnum.SUPER_ADMIN)
@Controller('roles')
export class RolesController extends ApiController {
	@Inject() private readonly rolesService: RolesService

	@Get()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiQuery({ type: PaginationDto })
	@RequirePermission('read')
	async findAll(@Query() query: PaginationDto, @CurrentUser() user: User) {
		return await this.rolesService.findAll(query, user)
	}

	@Get(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	findOne(@Param('id') id: string, @CurrentUser() user: User) {
		return this.rolesService.findOne(id, user)
	}
	@Get('some')
	async getSomeRoles() {
		return this.rolesService.getSomeRoles()
	}
	@Post()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	create(@Body() dto: RoleCreateDto, @CurrentUser() user: User) {
		return this.rolesService.create(dto, user)
	}

	@Put(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	update(
		@Param('id') id: string,
		@Body() dto: RoleUpdateDto,
		@CurrentUser() user: User
	) {
		return this.rolesService.update(id, dto, user)
	}

	@Delete(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	remove(@Param('id') id: string, @CurrentUser() user: User) {
		return this.rolesService.remove(id, user)
	}
}
