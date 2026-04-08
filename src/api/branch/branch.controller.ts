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
import { RolesEnum } from 'src/constantis'
import { RequirePermission } from 'src/decorators/permissions.decorator'
import { RolesD } from 'src/decorators/role.decorator'
import { RolesGuard } from 'src/guards/check.role.groard'
import { JwtAuthGuard } from 'src/guards/jwt.guard'
import { PaginationDto } from 'src/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { BranchService } from './branch.service'
import { BranchCreateDto } from './dto'
@ApiTags('Branch')
@ApiBearerAuth('JWT-auth')
@Controller('branch')
@UseGuards(JwtAuthGuard, RolesGuard)
@RolesD(
	RolesEnum.ADMIN,
	RolesEnum.SUPER_ADMIN,
)
export class BranchController extends ApiController {
	@Inject() private readonly branchService: BranchService

	@Get()
	@RequirePermission('read')
	async getAllBranches(@Query() pagination: PaginationDto) {
		return this.branchService.findAll(pagination)
	}
	@Get(':id')
	@RequirePermission('view')
	async getBranchById(@Param('id') id: string) {
		return this.branchService.findOne(id)
	}

	@Post()
	@RequirePermission('create')
	async createBranch(@Body() data: BranchCreateDto) {
		return this.branchService.create(data)
	}

	@Put(':id')
	@RequirePermission('update')
	async updateBranch(@Param('id') id: string, @Body() data: BranchCreateDto) {
		return this.branchService.update(id, data)
	}

	@Delete(':id')
	@RequirePermission('remove')
	async deleteBranch(@Param('id') id: string) {
		return this.branchService.remove(id)
	}
}
