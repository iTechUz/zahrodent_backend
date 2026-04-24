import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { EskizService } from './eskiz.service';
import { BookingsModule } from '../bookings/bookings.module';
import { PatientsModule } from '../patients/patients.module';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [BookingsModule, PatientsModule],
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
