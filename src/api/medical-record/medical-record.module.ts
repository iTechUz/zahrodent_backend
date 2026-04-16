import { Module } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { MedicalRecordController } from './medical-record.controller'
import { MedicalRecordService } from './medical-record.service'

@Module({
  controllers: [MedicalRecordController],
  providers: [MedicalRecordService, PrismaService],
  exports: [MedicalRecordService],
})
export class MedicalRecordModule {}
