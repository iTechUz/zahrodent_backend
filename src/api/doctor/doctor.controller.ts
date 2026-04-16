import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PaginationDto } from 'src/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { DoctorService } from './doctor.service'
import { CreateScheduleDto, DoctorFilterDto, UpdateScheduleDto } from './dto'

@ApiTags('Doctors')
@ApiBearerAuth('JWT-auth')
@Controller('doctors')
export class DoctorController extends ApiController {
  constructor(private readonly doctorService: DoctorService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha shifokorlar ro\'yxati' })
  findAll(@Query() pagination: DoctorFilterDto) {
    return this.doctorService.findAll(pagination)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta shifokor' })
  findOne(@Param('id') id: string) {
    return this.doctorService.findOne(id)
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Shifokor ish jadvali' })
  getSchedule(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.doctorService.getSchedule(id, branchId)
  }

  @Get(':id/patients')
  @ApiOperation({ summary: 'Shifokorga biriktirilgan bemorlar' })
  getAssignedPatients(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.doctorService.getAssignedPatients(id, pagination)
  }

  @Get(':id/bookings')
  @ApiOperation({ summary: 'Shifokor bronlari' })
  getDoctorBookings(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.doctorService.getDoctorBookings(id, pagination)
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Jadval qo\'shish yoki yangilash' })
  upsertSchedule(@Param('id') id: string, @Body() data: CreateScheduleDto) {
    return this.doctorService.upsertSchedule(id, data)
  }

  @Put(':id/schedule/:scheduleId')
  @ApiOperation({ summary: 'Jadval o\'zgartirish' })
  updateSchedule(@Param('scheduleId') scheduleId: string, @Body() data: UpdateScheduleDto) {
    return this.doctorService.updateSchedule(scheduleId, data)
  }

  @Delete(':id/schedule/:scheduleId')
  @ApiOperation({ summary: 'Jadval o\'chirish' })
  removeSchedule(@Param('scheduleId') scheduleId: string) {
    return this.doctorService.removeSchedule(scheduleId)
  }
}
