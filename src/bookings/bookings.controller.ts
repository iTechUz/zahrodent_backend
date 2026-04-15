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
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('bookings')
@ApiBearerAuth('JWT')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Stats for bookings page' })
  getStats() {
    return this.bookingsService.getStats();
  }

  @Get()
  @ApiOperation({ summary: "Qabullar ro'yxati" })
  findAll(
    @Query() query: PaginationQueryDto & {
      status?: string;
      source?: string;
      patientId?: string;
      dateRange?: 'today' | 'week' | 'month' | 'all';
    },
  ) {
    return this.bookingsService.findAll(query);
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
  @ApiOperation({ summary: "Qabulni yangilash (holat o'zgartirish)" })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Qabulni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
