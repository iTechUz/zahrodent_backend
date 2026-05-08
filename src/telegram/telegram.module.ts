import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [LeadsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
