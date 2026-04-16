import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiController } from '../jwt.check.controller'
import { BookingService } from './booking.service'
import {
  AvailableSlotsDto,
  BookingFilterDto,
  CancelBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto'

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@Controller('bookings')
export class BookingController extends ApiController {
  constructor(private readonly bookingService: BookingService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha bronlar ro\'yxati' })
  findAll(@Query() pagination: BookingFilterDto) {
    return this.bookingService.findAll(pagination)
  }

  @Get('available-slots')
  @ApiOperation({ summary: 'Shifokorning bo\'sh vaqt slotlari' })
  getAvailableSlots(@Query() query: AvailableSlotsDto) {
    return this.bookingService.getAvailableSlots(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta bron' })
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Bron yaratish' })
  create(@Body() data: CreateBookingDto) {
    return this.bookingService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Bronni tahrirlash' })
  update(@Param('id') id: string, @Body() data: UpdateBookingDto) {
    return this.bookingService.update(id, data)
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Bronni tasdiqlash' })
  confirm(@Param('id') id: string) {
    return this.bookingService.confirm(id)
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Bronni bekor qilish' })
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingService.cancel(id, dto)
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Bronni yakunlash' })
  complete(@Param('id') id: string) {
    return this.bookingService.complete(id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bronni o\'chirish' })
  remove(@Param('id') id: string) {
    return this.bookingService.remove(id)
  }
}
