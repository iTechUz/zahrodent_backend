import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationLog, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramBotRegistry } from '../telegram/telegram-bot.registry';

export type NotificationLogStatus = 'pending' | 'sent' | 'failed';

export const MAX_ATTEMPTS = 6;
/** Delay before attempt N+1 (index = attempts made so far − 1). */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  3 * 60 * 60_000,
];
/** A claimed row is not re-claimed by another worker for this long. */
const CLAIM_MS = 2 * 60_000;
const POLL_MS = 30_000;
const BATCH = 20;
const ERROR_MAX = 300;

export type EnqueueInput = {
  kind: string;
  chatId: string;
  text: string;
  replyMarkup?: Prisma.InputJsonValue;
  leadId?: string;
  patientId?: string;
};

/**
 * Telegram outbox + delivery history (`notification_logs`). Every message is
 * stored first, then sent; failures are retried with backoff by a poller
 * until MAX_ATTEMPTS, then marked `failed` (shown in the admin).
 * Telegram 400/403 (chat not found, bot blocked) are permanent: no retries.
 * Never throws to callers — a Telegram problem must not break business flow.
 */
@Injectable()
export class NotificationLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationLogService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramBotRegistry,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.processDue(), POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Stores the message and tries to send it right away. */
  async enqueue(input: EnqueueInput): Promise<NotificationLog | null> {
    try {
      const row = await this.prisma.notificationLog.create({
        data: {
          kind: input.kind,
          chatId: input.chatId,
          text: input.text,
          replyMarkup: input.replyMarkup,
          leadId: input.leadId,
          patientId: input.patientId,
        },
      });
      return await this.attempt(row);
    } catch (e) {
      this.logger.warn(`Xabarni navbatga qo'yib bo'lmadi: ${errMsg(e)}`);
      return null;
    }
  }

  /** Sends rows whose retry time has come. Returns how many were attempted. */
  async processDue(now: Date = new Date()): Promise<number> {
    try {
      const due = await this.prisma.notificationLog.findMany({
        where: { status: 'pending', nextAttemptAt: { lte: now } },
        orderBy: { nextAttemptAt: 'asc' },
        take: BATCH,
      });
      let n = 0;
      for (const row of due) {
        // Claim: only one replica sends a given row.
        const claimed = await this.prisma.notificationLog.updateMany({
          where: { id: row.id, status: 'pending', nextAttemptAt: { lte: now } },
          data: { nextAttemptAt: new Date(now.getTime() + CLAIM_MS) },
        });
        if (claimed.count !== 1) continue;
        await this.attempt(row);
        n += 1;
      }
      return n;
    } catch (e) {
      this.logger.warn(`Navbatni qayta ishlashda xato: ${errMsg(e)}`);
      return 0;
    }
  }

  private async attempt(row: NotificationLog): Promise<NotificationLog> {
    const extra = row.replyMarkup
      ? { reply_markup: row.replyMarkup as Record<string, unknown> }
      : undefined;
    const res = await this.telegram.sendMessage(row.chatId, row.text, extra);
    const attempts = row.attempts + 1;
    if (!('error' in res)) {
      return this.prisma.notificationLog.update({
        where: { id: row.id },
        data: { status: 'sent', attempts, sentAt: new Date(), lastError: null },
      });
    }
    const permanent = isPermanentTelegramError(res.error);
    const giveUp = permanent || attempts >= MAX_ATTEMPTS;
    this.logger.warn(
      `Telegram yuborilmadi (${row.kind}, urinish ${attempts}): ${res.error.slice(0, 120)}`,
    );
    return this.prisma.notificationLog.update({
      where: { id: row.id },
      data: {
        status: giveUp ? 'failed' : 'pending',
        attempts,
        lastError: res.error.slice(0, ERROR_MAX),
        nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
      },
    });
  }

  /** Admin: put a failed row back in the queue. */
  async retry(id: string) {
    const row = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Log topilmadi');
    if (row.status === 'sent') return row;
    const updated = await this.prisma.notificationLog.update({
      where: { id },
      data: { status: 'pending', attempts: 0, nextAttemptAt: new Date() },
    });
    return this.attempt(updated);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    kind?: string;
  }) {
    const take = Number(query.limit || 20);
    const skip = Number(query.page || 0) * take;
    const where: Prisma.NotificationLogWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.kind) where.kind = query.kind;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);
    return { data, total };
  }

  /** For the admin warning banner: failures in the last 24h + queue size. */
  async summary(now: Date = new Date()) {
    const since = new Date(now.getTime() - 24 * 60 * 60_000);
    const [failed24h, pending] = await Promise.all([
      this.prisma.notificationLog.count({
        where: { status: 'failed', createdAt: { gte: since } },
      }),
      this.prisma.notificationLog.count({ where: { status: 'pending' } }),
    ]);
    return { failed24h, pending };
  }
}

export function retryDelayMs(attemptsMade: number): number {
  return RETRY_DELAYS_MS[Math.min(attemptsMade, RETRY_DELAYS_MS.length) - 1];
}

/** Telegram 400 (bad chat) / 403 (bot blocked) never succeed on retry. */
export function isPermanentTelegramError(error: string): boolean {
  return /^(400|403)\b/.test(error.trim());
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
