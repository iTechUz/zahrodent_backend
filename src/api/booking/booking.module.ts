import { Module } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { GatewayModule } from 'src/gateway/gateway.module'
import { BookingController } from './booking.controller'
import { BookingService } from './booking.service'

@Module({
  imports: [GatewayModule],
  controllers: [BookingController],
  providers: [BookingService, PrismaService],
  exports: [BookingService],
})
export class BookingModule {}
