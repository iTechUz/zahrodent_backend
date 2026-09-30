import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { EskizService } from './eskiz.service';
import { PatientsModule } from '../patients/patients.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramCoreModule } from '../telegram/telegram-core.module';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PatientsModule, SettingsModule, TelegramCoreModule],
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
