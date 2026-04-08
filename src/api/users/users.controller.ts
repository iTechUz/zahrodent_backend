import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiBody,
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/guards/jwt.guard'
// import { Auth } from '../../decorators/auth.decorator'
import { RequirePermission } from 'src/decorators/permissions.decorator'
import { CurrentUser } from '../../decorators/user.decorator'
import { FileUploadService } from '../file-upload/file-upload.service'
import {
	CreateUserDto,
	filterByUserDto,
	IUserProfileDto,
	SetCurrentBranchDto,
	UpdateUserDto
} from './dto/user.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly fileUploadService: FileUploadService
	) {}

	@Get()
	// @Auth(Role.SUPER_ADMIN)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@RequirePermission('read')
	async findAll(@Query() pagination: filterByUserDto) {
		return this.usersService.findAll(pagination)
	}

	@Get('/number-of-users')
	@RequirePermission('read')
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	numberOfUsers() {
		return this.usersService.numberOfUsers()
	}

	@Get('/me')
	@RequirePermission('view')

	// @Auth(Role.STUDENT, Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiOperation({ summary: 'Get current user information' })
	getMe(@CurrentUser() user: IUserProfileDto) {
		return this.usersService.findOne(user.id, user)
	}

	@Get(':id')
	@RequirePermission('view')
	// @Auth(Role.SUPER_ADMIN)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	findOne(@Param('id') id: string) {
		return this.usersService.findOne(id)
	}

	@Patch(':branchId')
	@RequirePermission('update')
	// @Auth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.TEACHER, Role.STUDENT)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiBody({ type: SetCurrentBranchDto })
	async updateCurrentBranch(
		@CurrentUser() user,
		@Param('branchId') branchId: string
	) {
		return this.usersService.setCurrentBranch(user, branchId)
	}

	@Put(':id')
	@RequirePermission('update')
	// @Auth(Role.SUPER_ADMIN)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiBody({ type: UpdateUserDto })
	update(@Param('id') id: string, @Body() data: Partial<CreateUserDto>) {
		return this.usersService.update(id, data)
	}

	@Delete(':id')
	@RequirePermission('remove')
	// @Auth(Role.SUPER_ADMIN)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	delete(@Param('id') id: string) {
		return this.usersService.remove(id)
	}

	@Post()
	// @RequirePermission('create')
	// @Auth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.TEACHER, Role.STUDENT)
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 404, description: 'Not found' })
	@ApiBody({ type: CreateUserDto })
	async uploadAvatar(
		@CurrentUser() user: IUserProfileDto,
		@Body() body: CreateUserDto
	) {
		return this.usersService.create(user, body)
	}
}
