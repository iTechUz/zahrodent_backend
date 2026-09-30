import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { LeadsModule } from '../leads/leads.module';
import { PatientsModule } from '../patients/patients.module';
import { TelegramCoreModule } from './telegram-core.module';

@Module({
  imports: [LeadsModule, PatientsModule, TelegramCoreModule],
  providers: [TelegramService],
})
export class TelegramModule {}
