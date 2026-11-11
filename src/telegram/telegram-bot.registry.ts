import { Injectable } from '@nestjs/common';

/** The part of `bot.telegram` used for outgoing messages and liveness. */
export type TelegramSender = {
  sendMessage(
    chatId: string | number,
    text: string,
    extra?: Record<string, unknown>,
  ): Promise<unknown>;
  /** Cheap liveness probe (Telegram `getMe`). */
  getMe?(): Promise<unknown>;
};

/** `disabled` — bot not configured/off; `ok` — reachable; `down` — failed. */
export type TelegramHealth = 'disabled' | 'ok' | 'down';

/** Consecutive permanent staff-group failures after which the group is reported as failing. */
export const GROUP_FAILURE_THRESHOLD = 3;

/** `ok` — fine; `failing` — group messages keep failing for good; `migrated` — group became a supergroup (update the env id). */
export type TelegramGroupHealth = 'ok' | 'failing' | 'migrated';

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
  /** old chat id → new id after Telegram's migrate_to_chat_id (in-memory until the env is fixed). */
  private redirects = new Map<string, string>();
  private groupFailures = 0;

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

  /**
   * `{ ok: false }` when the bot isn't running or Telegram rejects it. When the
   * chat was upgraded to a supergroup, Telegram answers 400 with
   * `migrate_to_chat_id`: it is remembered and returned as `migrateToChatId`.
   */
  async sendMessage(
    chatId: string,
    text: string,
    extra?: Record<string, unknown>,
  ): Promise<
    { ok: true } | { ok: false; error: string; migrateToChatId?: string }
  > {
    if (!this.sender) return { ok: false, error: 'bot not running' };
    const target = this.redirects.get(chatId) ?? chatId;
    try {
      if (extra) await this.sender.sendMessage(target, text, extra);
      else await this.sender.sendMessage(target, text);
      return { ok: true };
    } catch (e) {
      const migrated = migrateTargetOf(e);
      if (migrated) this.redirects.set(chatId, migrated);
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        ...(migrated ? { migrateToChatId: migrated } : {}),
      };
    }
  }

  /** New id the chat was migrated to (this process), if any. */
  migratedTo(chatId: string): string | undefined {
    return this.redirects.get(chatId);
  }

  /** A staff-group message was given up on for good (400/403/migrated). */
  reportGroupFailure() {
    this.groupFailures += 1;
  }

  /** A staff-group message was delivered → the group works again. */
  reportGroupSuccess() {
    this.groupFailures = 0;
  }

  groupHealth(): TelegramGroupHealth {
    if (this.redirects.size > 0) return 'migrated';
    return this.groupFailures >= GROUP_FAILURE_THRESHOLD ? 'failing' : 'ok';
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

/** Telegram's `parameters.migrate_to_chat_id` from a failed API call. */
function migrateTargetOf(e: unknown): string | undefined {
  const err = e as {
    response?: { parameters?: { migrate_to_chat_id?: number | string } };
    parameters?: { migrate_to_chat_id?: number | string };
  };
  const id =
    err?.response?.parameters?.migrate_to_chat_id ??
    err?.parameters?.migrate_to_chat_id;
  return id === undefined || id === null || id === '' ? undefined : String(id);
}
