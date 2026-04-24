import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
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
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('leads')
@ApiBearerAuth('JWT')
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'receptionist')
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
