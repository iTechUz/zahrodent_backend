import { Module } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { DentalServiceController } from './dental-service.controller'
import { DentalServiceService } from './dental-service.service'

@Module({
  controllers: [DentalServiceController],
  providers: [DentalServiceService, PrismaService],
  exports: [DentalServiceService],
})
export class DentalServiceModule {}
