import { Module } from '@nestjs/common';
import { TelegramBotRegistry } from './telegram-bot.registry';

/** Dependency-free holder of the bot sender (see TelegramBotRegistry). */
@Module({
  providers: [TelegramBotRegistry],
  exports: [TelegramBotRegistry],
})
export class TelegramCoreModule {}
