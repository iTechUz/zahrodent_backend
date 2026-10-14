import { Injectable } from '@nestjs/common';

/** The part of `bot.telegram` used for outgoing messages and liveness. */
export type TelegramSender = {
  sendMessage(chatId: string | number, text: string): Promise<unknown>;
  /** Cheap liveness probe (Telegram `getMe`). */
  getMe?(): Promise<unknown>;
};

/** `disabled` — bot not configured/off; `ok` — reachable; `down` — failed. */
export type TelegramHealth = 'disabled' | 'ok' | 'down';

/** How long a `getMe` result is reused (keeps /health/deps cheap). */
export const TELEGRAM_HEALTH_TTL_MS = 60_000;
export const TELEGRAM_PROBE_TIMEOUT_MS = 5_000;

/**
 * Holds the running bot's sender so other modules (reminders, leads) can send
 * messages without depending on the lead bot (which depends on leads →
 * notifications — a module cycle otherwise). Also tracks bot liveness for
 * /health/deps.
 */
@Injectable()
export class TelegramBotRegistry {
  private sender: TelegramSender | null = null;
  private failure: string | null = null;
  private cache: { at: number; value: 'ok' | 'down' } | null = null;
  private inflight: Promise<'ok' | 'down'> | null = null;

  register(sender: TelegramSender | null) {
    this.sender = sender;
    this.failure = null;
    this.cache = null;
  }

  /**
   * The bot died (launch error, 409 conflict, polling stopped unexpectedly).
   * Reported as `down` until the next `register()`.
   */
  reportFailure(reason: string) {
    this.failure = reason;
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

  /** Bot health for /health/deps; the Telegram probe is cached ~60s. */
  async health(now = Date.now()): Promise<TelegramHealth> {
    if (this.failure) return 'down';
    const sender = this.sender;
    if (!sender) return 'disabled';
    if (!sender.getMe) return 'ok';
    if (this.cache && now - this.cache.at < TELEGRAM_HEALTH_TTL_MS) {
      return this.cache.value;
    }
    this.inflight ??= this.probe(sender).finally(() => {
      this.inflight = null;
    });
    const value = await this.inflight;
    this.cache = { at: now, value };
    return value;
  }

  private async probe(sender: TelegramSender): Promise<'ok' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        sender.getMe!(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('getMe timeout')),
            TELEGRAM_PROBE_TIMEOUT_MS,
          );
        }),
      ]);
      return 'ok';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
