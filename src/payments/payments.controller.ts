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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES_FINANCE } from '../common/constants/role-groups';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_FINANCE)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Stats for payments page' })
  getStats() {
    return this.paymentsService.getStats();
  }

  @Get()
  @ApiOperation({ summary: "To'lovlar ro'yxati" })
  findAll(
    @Query() query: PaginationQueryDto & {
      status?: string;
      patientId?: string;
      method?: string;
      dateRange?: 'today' | 'week' | 'month' | 'all';
    },
  ) {
    return this.paymentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Bitta to'lov" })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Yangi to'lov" })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "To'lovni yangilash" })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "To'lovni o'chirish" })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
