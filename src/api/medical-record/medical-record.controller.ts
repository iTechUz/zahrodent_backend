import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiController } from '../jwt.check.controller'
import { MedicalRecordService } from './medical-record.service'
import { CreateMedicalRecordDto, MedicalRecordFilterDto, UpdateMedicalRecordDto } from './dto'

@ApiTags('Medical Records')
@ApiBearerAuth('JWT-auth')
@Controller('medical-records')
export class MedicalRecordController extends ApiController {
  constructor(private readonly medicalRecordService: MedicalRecordService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha tibbiy yozuvlar' })
  findAll(@Query() pagination: MedicalRecordFilterDto) {
    return this.medicalRecordService.findAll(pagination)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta tibbiy yozuv' })
  findOne(@Param('id') id: string) {
    return this.medicalRecordService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Tibbiy yozuv qo\'shish' })
  create(@Body() data: CreateMedicalRecordDto) {
    return this.medicalRecordService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Tibbiy yozuvni yangilash' })
  update(@Param('id') id: string, @Body() data: UpdateMedicalRecordDto) {
    return this.medicalRecordService.update(id, data)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Tibbiy yozuvni o\'chirish' })
  remove(@Param('id') id: string) {
    return this.medicalRecordService.remove(id)
  }
}
