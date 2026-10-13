import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { PublicLeadsController } from './public-leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeadsController, PublicLeadsController],
  providers: [LeadsService, LeadsRepository],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
