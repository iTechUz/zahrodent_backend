import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const logger = new Logger('EnvConfig');

export function parsePort(): number {
  const raw = process.env.PORT ?? '3000';
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid PORT="${raw}" — use integer 1–65535`);
  }
  return n;
}

export function getListenHost(): string {
  const h = process.env.HOST?.trim();
  return h && h.length > 0 ? h : '0.0.0.0';
}

export function getPublicBaseUrl(port: number): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return `http://localhost:${port}`;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isSwaggerEnabled(prod: boolean): boolean {
  const v = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  return !prod;
}

export function buildCorsOptions(prod: boolean): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  const list = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const common: Pick<CorsOptions, 'credentials' | 'methods' | 'allowedHeaders'> = {
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };

  if (list.length > 0) {
    return {
      ...common,
      origin: (origin, cb) => {
        if (!origin) {
          cb(null, true);
          return;
        }
        cb(null, list.includes(origin));
      },
    };
  }

  if (prod) {
    throw new Error(
      'Production: CORS_ORIGINS majburiy. Misol: CORS_ORIGINS=https://app.example.com,https://www.example.com',
    );
  }

  logger.warn(
    "CORS_ORIGINS bo'sh — dev rejimda barcha origin'lar qabul qilinadi (origin: true).",
  );
  return { ...common, origin: true };
}

export function warnWeakJwtSecret(prod: boolean): void {
  const secret = process.env.JWT_SECRET?.trim();
  const weak =
    !secret ||
    secret === 'change-me-in-production-use-long-random-string' ||
    secret === 'dev-secret-change-me';
  if (prod && weak) {
    logger.warn(
      'JWT_SECRET standart yoki yo\'q — production\'da kuchli tasodifiy qator qo\'ying',
    );
  }
}

export function enforceProductionJwtSecret(): void {
  if (!isProduction()) return;
  const secret = process.env.JWT_SECRET?.trim();
  const weak =
    !secret ||
    secret.length < 32 ||
    secret === 'change-me-in-production-use-long-random-string' ||
    secret === 'dev-secret-change-me';
  if (weak) {
    throw new Error(
      'Production: JWT_SECRET majburiy — kamida 32 belgi, tasodifiy qator (dev-secret va change-me taqiqlangan)',
    );
  }
}
