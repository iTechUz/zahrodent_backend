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

import { PaginationDto } from 'src/utils/paginations'
import { ApiController } from '../jwt.check.controller'
import { PatientService } from './patient.service'
import { PatientCreateDto } from './dto'
@ApiTags('Branch')
@ApiBearerAuth('JWT-auth')
@Controller('patients')

export class PatientController extends ApiController {
	constructor(private readonly patientService: PatientService){
		super()
	}

	@Get()
	async getAllPatients(@Query() pagination: PaginationDto) {
		return this.patientService.findAll(pagination)
	}
	@Get(':id')
	async getPatientById(@Param('id') id: string) {
		return this.patientService.findOne(id)
	}

	@Post()
	async createPatient(@Body() data: PatientCreateDto) {
		return this.patientService.create(data)
	}

	@Put(':id')
	async updatePatient(@Param('id') id: string, @Body() data: PatientCreateDto) {
		return this.patientService.update(id, data)
	}

	@Delete(':id')
	async deletePatient(@Param('id') id: string) {
		return this.patientService.remove(id)
	}
}
