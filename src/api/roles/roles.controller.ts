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
import { RoleCreateDto } from './dto'

import { CurrentUser } from '@/decorators/user.decorator'
import { PaginationDto } from '@/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { RolesService } from './roles.service'
import { IUserProfileDto } from '../users/dto/user.dto'

@ApiTags('Roles')
@Controller('roles')
export class RolesController extends ApiController {
	constructor(private readonly rolesService: RolesService) {
		super()
	}

	@Get()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiQuery({ type: PaginationDto })
	async findAll(@Query() query: PaginationDto, @CurrentUser() user: IUserProfileDto) {
		return await this.rolesService.findAll(query, user)
	}

	@Get(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	findOne(@Param('id') id: string, @CurrentUser() user: IUserProfileDto) {
		return this.rolesService.findOne(id, user)
	}
	@Get('some')
	async getSomeRoles() {
		return this.rolesService.getSomeRoles()
	}
	@Post()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	create(@Body() dto: RoleCreateDto, @CurrentUser() user: IUserProfileDto) {
		return this.rolesService.create(dto, user)
	}

	@Put(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	update(
		@Param('id') id: string,
		@CurrentUser() user: IUserProfileDto
	) {
		// return this.rolesService.update(id, dto, user)
	}

	@Delete(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	remove(@Param('id') id: string, @CurrentUser() user: IUserProfileDto) {
		return this.rolesService.remove(id, user)
	}
}
