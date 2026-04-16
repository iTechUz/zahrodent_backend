import { Module } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { GatewayModule } from 'src/gateway/gateway.module'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'

@Module({
  imports: [GatewayModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
