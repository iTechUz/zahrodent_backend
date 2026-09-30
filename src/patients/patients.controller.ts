import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreatePatientCommentDto } from './dto/create-patient-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_STAFF } from '../common/constants/role-groups';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';
import { PatientsQueryDto } from './dto/patients-query.dto';
import { PatientFindOneQueryDto } from './dto/patient-find-one-query.dto';

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
  findAll(@Query() query: PatientsQueryDto, @GetUser() user: AuthUserView) {
    return this.patientsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Bitta bemor',
    description:
      "O'chirilgan bemor — 404, faqat admin `?includeDeleted=true` bilan ko'ra oladi (`deletedAt` to'ldirilgan).",
  })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Bemor topilmadi' })
  findOne(
    @Param('id') id: string,
    @Query() query: PatientFindOneQueryDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.patientsService.findOne(id, user, {
      includeDeleted: query.includeDeleted === 'true',
    });
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
  @Roles('admin')
  @ApiOperation({
    summary: "Bemorni o'chirish — soft delete (faqat admin)",
    description:
      "`deletedAt` qo'yiladi: bemor barcha ro'yxat/statistika/qidiruvlardan yashiriladi. Tashrif, to'lov va o'tgan qabullar saqlanadi (moliya ro'yxatlarida `patient.deletedAt` bilan). Bugundan keyingi pending/confirmed qabullar `cancelled` qilinadi.",
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { id: { type: 'string' } } },
  })
  @ApiNotFoundResponse({
    description: "Bemor topilmadi yoki allaqachon o'chirilgan",
  })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.patientsService.remove(id, user);
  }

  @Post(':id/restore')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({
    summary: "O'chirilgan bemorni tiklash (faqat admin)",
    description:
      "`deletedAt` tozalanadi va bemor qaytariladi. Bekor qilingan qabullar avtomatik tiklanmaydi. O'chirilmagan bemor uchun ham 200 (idempotent).",
  })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Bemor topilmadi' })
  restore(@Param('id') id: string) {
    return this.patientsService.restore(id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: "Izoh qo'shish" })
  @ApiParam({ name: 'id' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreatePatientCommentDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.patientsService.addComment({ ...dto, patientId: id }, user);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: "Bemor izohlari ro'yxati" })
  @ApiParam({ name: 'id' })
  findComments(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.patientsService.findComments(id, user);
  }
}
