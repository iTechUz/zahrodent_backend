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
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
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

@ApiTags('doctors')
@ApiBearerAuth('JWT')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('stats')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Stats for doctors page' })
  getStats() {
    return this.doctorsService.getStats();
  }

  @Get('efficiency')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Doctor efficiency and performance stats' })
  getEfficiency() {
    return this.doctorsService.getEfficiency();
  }

  @Get()
  @ApiOperation({ summary: "Shifokorlar ro'yxati" })
  findAll(@Query() query: PaginationQueryDto & { specialty?: string }) {
    return this.doctorsService.findAll(query);
  }

  @Get('me')
  @Roles('DOCTOR', 'ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Hozirgi shifokorning profili' })
  getMe(@GetUser() user: AuthUserView) {
    return this.doctorsService.findByUserId(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta shifokor' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Yangi shifokor' })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  create(@Body() dto: CreateDoctorDto, @GetUser() user: AuthUserView) {
    return this.doctorsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Shifokorni yangilash' })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin yoki o\'z profili' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.doctorsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: "Shifokorni o'chirish" })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }
}
