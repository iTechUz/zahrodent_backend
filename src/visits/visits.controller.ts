import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('visits')
@ApiBearerAuth('JWT')
@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: 'Tashriflar' })
  findAll(
    @Query()
    query: PaginationQueryDto & { patientId?: string; doctorId?: string },
    @GetUser() user: AuthUserView,
  ) {
    return this.visitsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta tashrif' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.visitsService.findOne(id, user);
  }

  @Post()
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Yangi tashrif' })
  create(@Body() dto: CreateVisitDto) {
    return this.visitsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Tashrifni yangilash' })
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.visitsService.update(id, dto, user);
  }
}
