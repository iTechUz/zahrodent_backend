import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { BookingStatusService } from './booking-status.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository, BookingStatusService],
  exports: [BookingsService, BookingsRepository, BookingStatusService],
})
export class BookingsModule {}
