import { Injectable } from '@nestjs/common';

/** The part of `bot.telegram` used for outgoing messages. */
export type TelegramSender = {
  sendMessage(chatId: string | number, text: string): Promise<unknown>;
};

/**
 * Holds the running bot's sender so other modules (reminders) can send
 * messages without depending on the lead bot (which depends on leads →
 * notifications — a module cycle otherwise).
 */
@Injectable()
export class TelegramBotRegistry {
  private sender: TelegramSender | null = null;

  register(sender: TelegramSender | null) {
    this.sender = sender;
  }

  /** True while the bot is running in this process. */
  isAvailable(): boolean {
    return this.sender !== null;
  }

  /** `{ ok: false }` when the bot isn't running or Telegram rejects it. */
  async sendMessage(
    chatId: string,
    text: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.sender) return { ok: false, error: 'bot not running' };
    try {
      await this.sender.sendMessage(chatId, text);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
