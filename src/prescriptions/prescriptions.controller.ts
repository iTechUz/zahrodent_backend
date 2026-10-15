import {
  Body,
  Controller,
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
  ApiTags,
} from '@nestjs/swagger';
import { AuthUserView } from '../auth/auth.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PharmacySearchDto } from './dto/pharmacy-search.dto';
import { PrescriptionsQueryDto } from './dto/prescriptions-query.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('prescriptions')
@ApiBearerAuth('JWT')
@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_STAFF)
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Retseptlar (doctor — faqat o‘zinikilari)' })
  findAll(
    @Query() query: PrescriptionsQueryDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.service.findAll(query, user);
  }

  // Declared before `:id` so "pharmacy" isn't taken for an id.
  @Get('pharmacy/search')
  @Roles('admin', 'pharmacist')
  @ApiOperation({
    summary: 'Apteka: faol retseptni kod yoki bemor telefoni bo‘yicha topish',
  })
  pharmacySearch(@Query() query: PharmacySearchDto) {
    return this.service.pharmacySearch(query.q);
  }

  @Post(':id/dispense')
  @Roles('admin', 'pharmacist')
  @ApiOperation({ summary: 'Apteka: retsept bo‘yicha dori berildi' })
  @ApiParam({ name: 'id' })
  dispense(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.service.dispense(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta retsept' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('admin', 'doctor')
  @ApiOperation({
    summary: 'Yangi elektron retsept',
    description:
      'doctor roli uchun doctorId doim o‘zining Doctor id si; bemor shifokorniki bo‘lishi kerak',
  })
  create(@Body() dto: CreatePrescriptionDto, @GetUser() user: AuthUserView) {
    return this.service.create(dto, user);
  }

  @Patch(':id/cancel')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Retseptni bekor qilish (faqat berilmagan)' })
  @ApiParam({ name: 'id' })
  cancel(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.service.cancel(id, user);
  }
}
