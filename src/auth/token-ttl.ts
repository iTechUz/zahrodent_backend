import { Logger } from '@nestjs/common';

export const DEFAULT_ACCESS_TOKEN_TTL = '15m';
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_REFRESH_TOKEN_TTL_DAYS = 365;

const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
  w: 604_800,
};

/**
 * `"15m"`, `"1h"`, `"7d"`, `"2w"`, `"900s"` or plain seconds (`"900"`) →
 * seconds. `null` for anything else (including zero / negative).
 */
export function parseDurationSeconds(raw: string | undefined): number | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  const m = /^(\d+)\s*([smhdw]?)$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]) * UNIT_SECONDS[m[2] || 's'];
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Access JWT lifetime in seconds (JWT_EXPIRES_IN, default 15m). */
export function getAccessTokenTtlSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN;
  const parsed = parseDurationSeconds(raw);
  if (parsed) return parsed;
  if (raw?.trim()) {
    new Logger('Auth').warn(
      `JWT_EXPIRES_IN="${raw}" tushunilmadi — ${DEFAULT_ACCESS_TOKEN_TTL} ishlatiladi`,
    );
  }
  return parseDurationSeconds(DEFAULT_ACCESS_TOKEN_TTL)!;
}

/** Refresh token lifetime in days (REFRESH_TOKEN_TTL_DAYS, default 30). */
export function getRefreshTokenTtlDays(): number {
  const n = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  return Math.min(n, MAX_REFRESH_TOKEN_TTL_DAYS);
}
