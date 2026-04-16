import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PaginationDto } from 'src/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { PatientService } from './patient.service'
import { PatientCreateDto, PatientFilterDto, PatientUpdateDto } from './dto'

@ApiTags('Patients')
@ApiBearerAuth('JWT-auth')
@Controller('patients')
export class PatientController extends ApiController {
  constructor(private readonly patientService: PatientService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha bemorlar ro\'yxati' })
  getAllPatients(@Query() pagination: PatientFilterDto) {
    return this.patientService.findAll(pagination)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta bemor' })
  getPatientById(@Param('id') id: string) {
    return this.patientService.findOne(id)
  }

  @Get(':id/bookings')
  @ApiOperation({ summary: 'Bemor bronlari tarixi' })
  getPatientBookings(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.patientService.findPatientBookings(id, pagination)
  }

  @Get(':id/medical-records')
  @ApiOperation({ summary: 'Bemor tibbiy tarixi' })
  getPatientMedicalRecords(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.patientService.findPatientMedicalRecords(id, pagination)
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Bemor to\'lovlari' })
  getPatientPayments(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.patientService.findPatientPayments(id, pagination)
  }

  @Post()
  @ApiOperation({ summary: 'Bemor qo\'shish' })
  createPatient(@Body() data: PatientCreateDto) {
    return this.patientService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Bemorni yangilash' })
  updatePatient(@Param('id') id: string, @Body() data: PatientUpdateDto) {
    return this.patientService.update(id, data)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bemorni o\'chirish' })
  deletePatient(@Param('id') id: string) {
    return this.patientService.remove(id)
  }
}
