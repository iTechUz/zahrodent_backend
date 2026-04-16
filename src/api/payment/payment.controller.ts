import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiController } from '../jwt.check.controller'
import { PaymentService } from './payment.service'
import { CreatePaymentDto, PaymentFilterDto, UpdatePaymentDto } from './dto'

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController extends ApiController {
  constructor(private readonly paymentService: PaymentService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha to\'lovlar' })
  findAll(@Query() pagination: PaymentFilterDto) {
    return this.paymentService.findAll(pagination)
  }

  @Get('stats')
  @ApiOperation({ summary: 'To\'lov statistikasi' })
  getStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.paymentService.getStats(dateFrom, dateTo, branchId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta to\'lov' })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'To\'lov kiritish' })
  create(@Body() data: CreatePaymentDto) {
    return this.paymentService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: 'To\'lovni yangilash' })
  update(@Param('id') id: string, @Body() data: UpdatePaymentDto) {
    return this.paymentService.update(id, data)
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'To\'lovni tasdiqlash (PAID)' })
  confirm(@Param('id') id: string) {
    return this.paymentService.confirm(id)
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'To\'lovni bekor qilish' })
  cancel(@Param('id') id: string) {
    return this.paymentService.cancel(id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'To\'lovni o\'chirish' })
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id)
  }
}
