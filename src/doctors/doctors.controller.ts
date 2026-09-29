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
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorsQueryDto } from './dto/doctors-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('doctors')
@ApiBearerAuth('JWT')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'receptionist')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Stats for doctors page' })
  getStats() {
    return this.doctorsService.getStats();
  }

  @Get('efficiency')
  @Roles('admin')
  @ApiOperation({ summary: 'Doctor efficiency and performance stats' })
  getEfficiency() {
    return this.doctorsService.getEfficiency();
  }

  @Get()
  @Roles('admin', 'receptionist', 'doctor')
  @ApiOperation({
    summary: "Shifokorlar ro'yxati",
    description: 'doctor roli uchun faqat o‘qish',
  })
  findAll(@Query() query: DoctorsQueryDto) {
    return this.doctorsService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'receptionist', 'doctor')
  @ApiOperation({ summary: 'Bitta shifokor' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Yangi shifokor' })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Shifokorni yangilash' })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  update(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    return this.doctorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({
    summary: "Shifokorni o'chirish",
    description:
      "Shifokor va uning login hisobi bitta tranzaksiyada o'chiriladi. Qabul/tashrif tarixi bo'lsa — 409.",
  })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }
}
