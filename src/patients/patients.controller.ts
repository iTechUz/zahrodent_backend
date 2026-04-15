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
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('patients')
@ApiBearerAuth('JWT')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Bemorlar statistikasi' })
  getStats(@GetUser() user: AuthUserView) {
    return this.patientsService.getStats(user);
  }

  @Get()
  @ApiOperation({ summary: "Bemorlar ro'yxati" })
  findAll(
    @Query() query: PaginationQueryDto & { source?: string },
    @GetUser() user: AuthUserView,
  ) {
    return this.patientsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta bemor' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.patientsService.findOne(id, user);
  }

  @Post()
  @Roles('admin', 'receptionist')
  @ApiOperation({ summary: 'Yangi bemor' })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Bemor ma’lumotlarini yangilash' })
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.patientsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('admin', 'receptionist')
  @ApiOperation({ summary: "Bemorni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.patientsService.remove(id, user);
  }
}
