import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { EskizService } from './eskiz.service';
import { BookingsModule } from '../bookings/bookings.module';
import { PatientsModule } from '../patients/patients.module';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, BookingsModule, PatientsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EskizService,
    NotificationsGateway,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
