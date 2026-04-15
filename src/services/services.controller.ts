import {
  Body,
  Controller,
  Delete,
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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('services')
@ApiBearerAuth('JWT')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Stats for services page' })
  getStats() {
    return this.servicesService.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'Xizmatlar katalogi' })
  findAll(@Query() query: PaginationQueryDto & { category?: string }) {
    return this.servicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta xizmat' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi xizmat' })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Xizmatni yangilash' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Xizmatni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
