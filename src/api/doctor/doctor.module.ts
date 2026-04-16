import { Module } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { DoctorController } from './doctor.controller'
import { DoctorService } from './doctor.service'

@Module({
  controllers: [DoctorController],
  providers: [DoctorService, PrismaService],
  exports: [DoctorService],
})
export class DoctorModule {}
