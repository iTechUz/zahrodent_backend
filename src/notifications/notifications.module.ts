import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { EskizService } from './eskiz.service';
import { BookingsModule } from '../bookings/bookings.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [BookingsModule, PatientsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, EskizService],
})
export class NotificationsModule {}
