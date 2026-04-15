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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
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
  findAll(@Query() query: PaginationQueryDto & { patientId?: string; doctorId?: string }) {
    return this.visitsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta tashrif' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi tashrif' })
  create(@Body() dto: CreateVisitDto) {
    return this.visitsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tashrifni yangilash' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.visitsService.update(id, dto);
  }
}
