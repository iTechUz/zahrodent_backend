import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RefreshTokensRepository } from './refresh-tokens.repository';

/** Expired/revoked refresh tokens are kept this long, then deleted. */
export const REFRESH_TOKEN_RETENTION_DAYS = 7;
const DAY_MS = 86_400_000;
const FIRST_RUN_DELAY_MS = 60_000;

/**
 * Daily cleanup of stale refresh tokens. `@nestjs/schedule` is not a
 * dependency, so a plain unref'd timer is used (runs in every API process;
 * the DELETE is idempotent, so several replicas are harmless).
 */
@Injectable()
export class RefreshTokensCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RefreshTokensCleanupService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly repo: RefreshTokensRepository) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const first = setTimeout(() => void this.cleanup(), FIRST_RUN_DELAY_MS);
    const daily = setInterval(() => void this.cleanup(), DAY_MS);
    first.unref();
    daily.unref();
    this.timers = [first, daily];
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Never throws — a failed cleanup is retried the next day. */
  async cleanup(now: Date = new Date()): Promise<number> {
    const before = new Date(
      now.getTime() - REFRESH_TOKEN_RETENTION_DAYS * DAY_MS,
    );
    try {
      const n = await this.repo.deleteStale(before);
      if (n) this.logger.log(`Eskirgan refresh tokenlar o'chirildi: ${n}`);
      return n;
    } catch (e) {
      this.logger.warn(
        `Refresh token tozalash xatosi: ${e instanceof Error ? e.message : String(e)}`,
      );
      return 0;
    }
  }
}
