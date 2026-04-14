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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';

@ApiTags('patients')
@ApiBearerAuth('JWT')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: "Bemorlar ro'yxati" })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Ism, familiya yoki telefon',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maks 500, ixtiyoriy',
  })
  findAll(@Query('search') search?: string, @Query('limit') limitStr?: string) {
    const limit = limitStr != null ? Number.parseInt(limitStr, 10) : undefined;
    return this.patientsService.findAll(search, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta bemor' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi bemor' })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Bemorni yangilash (tish xaritasi shu yerda)' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Bemorni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}
