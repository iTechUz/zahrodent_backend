import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { BranchModule } from './branch/branch.module'
import { DateTimeModule } from './date-time/date-time.module'
import { MinioClientModule } from './minio/minio-client.module'
import { RolesModule } from './roles/roles.module'
import { UsersModule } from './users/users.module'
import { PatientModule } from './patient/patient.module'
import { BookingModule } from './booking/booking.module'
import { DoctorModule } from './doctor/doctor.module'
import { MedicalRecordModule } from './medical-record/medical-record.module'
import { DentalServiceModule } from './dental-service/dental-service.module'
import { PaymentModule } from './payment/payment.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    AuthModule,
    UsersModule,
    MinioClientModule,
    DateTimeModule,
    RolesModule,
    BranchModule,
    PatientModule,
    BookingModule,
    DoctorModule,
    MedicalRecordModule,
    DentalServiceModule,
    PaymentModule,
    NotificationsModule,
  ],
})
export class ApiModule {}
