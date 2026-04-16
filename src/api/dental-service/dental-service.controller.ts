import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiController } from '../jwt.check.controller'
import { DentalServiceService } from './dental-service.service'
import { CreateServiceDto, ServiceFilterDto, UpdateServiceDto } from './dto'

@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class DentalServiceController extends ApiController {
  constructor(private readonly dentalServiceService: DentalServiceService) {
    super()
  }

  @Get()
  @ApiOperation({ summary: 'Barcha xizmatlar va narxlar' })
  findAll(@Query() pagination: ServiceFilterDto) {
    return this.dentalServiceService.findAll(pagination)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta xizmat' })
  findOne(@Param('id') id: string) {
    return this.dentalServiceService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Xizmat qo\'shish' })
  create(@Body() data: CreateServiceDto) {
    return this.dentalServiceService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Xizmatni yangilash' })
  update(@Param('id') id: string, @Body() data: UpdateServiceDto) {
    return this.dentalServiceService.update(id, data)
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Xizmatni faolsizlashtirish' })
  deactivate(@Param('id') id: string) {
    return this.dentalServiceService.deactivate(id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xizmatni o\'chirish' })
  remove(@Param('id') id: string) {
    return this.dentalServiceService.remove(id)
  }
}
