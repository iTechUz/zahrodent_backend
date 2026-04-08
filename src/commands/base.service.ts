import { ApiController } from '@/api/jwt.check.controller'
import { CurrentUser } from '@/decorators/user.decorator'
import { PaginationDto } from '@/utils/paginations'
import {
	Body,
	Delete,
	Get,
	Param,
	Post,
	Put,
	Query,
	Type
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { IUserProfileDto } from '@/services/user/dto'

export function CrudController<TCreate, TUpdate>(
  CreateDto: Type<TCreate>,
  UpdateDto: Type<TUpdate>
){
@ApiBearerAuth()
 abstract class BaseController extends ApiController {

	constructor(
		public readonly service: any,
	) {
		super()
	
	}
	@Get()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiQuery({ type: PaginationDto })
	async findAll(@Query() query: PaginationDto, @CurrentUser() user: IUserProfileDto) {
		return await this.service.findAll(query, user)
	}

	@Get(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	findOne(@Param('id') id: string, @CurrentUser() user: IUserProfileDto) {
		return this.service.findOne(id, user)
	}
	@Post()
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiBody({ type: CreateDto })
	create(@Body() dto: TCreate, @CurrentUser() user: IUserProfileDto) {
		return this.service.create(dto, user)
	}

	@Put(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiBody({ type: UpdateDto })
	update(
		@Param('id') id: string,
		@Body() dto: TUpdate,
		@CurrentUser() user: IUserProfileDto
	) {
		return this.service.update(id, dto, user)
	}

	@Delete(':id')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	remove(@Param('id') id: string, @CurrentUser() user: IUserProfileDto) {
		return this.service.remove(id, user)
	}
}
return BaseController;
}
