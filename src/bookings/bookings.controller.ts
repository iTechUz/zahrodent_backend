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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';

@ApiTags('bookings')
@ApiBearerAuth('JWT')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Qabullar ro\'yxati' })
  @ApiQuery({ name: 'search', required: false, description: 'Bemor ismi bo\'yicha' })
  @ApiQuery({ name: 'status', required: false, example: 'all', description: 'all yoki holat' })
  @ApiQuery({ name: 'source', required: false, example: 'all', description: 'all yoki manba' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Faqat shu bemorga tegishli qabullar' })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr != null ? Number.parseInt(limitStr, 10) : undefined;
    return this.bookingsService.findAll({ search, status, source, patientId, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta qabul' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi qabul' })
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Qabulni yangilash (holat o\'zgartirish)' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Qabulni o\'chirish' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
