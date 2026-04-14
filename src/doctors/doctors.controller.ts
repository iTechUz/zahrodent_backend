import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ROLES_DOCTOR_WRITE,
  ROLES_STAFF,
} from '../common/constants/role-groups';

@ApiTags('doctors')
@ApiBearerAuth('JWT')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: "Shifokorlar ro'yxati" })
  findAll() {
    return this.doctorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta shifokor' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Post()
  @Roles(...ROLES_DOCTOR_WRITE)
  @ApiOperation({ summary: 'Yangi shifokor' })
  @ApiForbiddenResponse({ description: 'Faqat admin va doctor' })
  create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  @Patch(':id')
  @Roles(...ROLES_DOCTOR_WRITE)
  @ApiOperation({ summary: 'Shifokorni yangilash' })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin va doctor' })
  update(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    return this.doctorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_DOCTOR_WRITE)
  @ApiOperation({ summary: "Shifokorni o'chirish" })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin va doctor' })
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }
}
