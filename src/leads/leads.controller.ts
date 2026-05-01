// Leads Controller for Sales Funnel
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';

@ApiTags('leads')
@ApiBearerAuth('JWT')
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: "Murojaatlar (lids) ro'yxati" })
  findAll(@Query() query: any) {
    return this.leadsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta murojaat' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }
  
  @Post()
  @ApiOperation({ summary: 'Qo\'lda murojaat qo\'shish' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Murojaatni bemorga aylantirish' })
  @ApiParam({ name: 'id' })
  convertToPatient(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.leadsService.convertToPatient(id, user.branchId!);
  }
  
  @Patch(':id')
  @ApiOperation({ summary: 'Murojaatni yangilash' })
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Murojaat holatini yangilash' })
  @ApiParam({ name: 'id' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Murojaatni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
