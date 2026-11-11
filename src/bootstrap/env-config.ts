import { Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
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

export type SwaggerCredentials = { user: string; password: string };

/** Swagger basic-auth login from env (both must be set), else null. */
export function getSwaggerCredentials(): SwaggerCredentials | null {
  const user = process.env.SWAGGER_USER?.trim();
  const password = process.env.SWAGGER_PASSWORD?.trim();
  return user && password ? { user, password } : null;
}

/**
 * Dev: on unless SWAGGER_ENABLED=false/0.
 * Production: OFF unless SWAGGER_ENABLED=true/1 AND SWAGGER_USER + SWAGGER_PASSWORD
 * are set (the UI and the JSON spec are then behind HTTP basic auth).
 * "Enabled but unprotected" in production is never allowed.
 */
export function isSwaggerEnabled(prod: boolean): boolean {
  const v = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') {
    return prod ? getSwaggerCredentials() !== null : true;
  }
  return !prod;
}

/** Express middleware: HTTP basic auth against `creds` (constant-time compare). */
export function swaggerBasicAuth(creds: SwaggerCredentials) {
  const safeEq = (a: string, b: string) => {
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
  };
  return (
    req: { headers: { authorization?: string } },
    res: {
      setHeader(k: string, v: string): void;
      status(c: number): { send(b: string): void };
    },
    next: () => void,
  ) => {
    const h = req.headers.authorization ?? '';
    if (h.startsWith('Basic ')) {
      const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (
        i >= 0 &&
        safeEq(decoded.slice(0, i), creds.user) &&
        safeEq(decoded.slice(i + 1), creds.password)
      ) {
        next();
        return;
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Swagger"');
    res.status(401).send('Unauthorized');
  };
}

export function isTrustProxyEnabled(): boolean {
  const v = process.env.TRUST_PROXY?.trim().toLowerCase();
  return v === '1' || v === 'true';
}

/**
 * Behind nginx every request comes from the proxy's IP. Without TRUST_PROXY the
 * throttler and the login lockout see ONE client → limits become global.
 * Returns true when the warning was logged.
 */
export function warnIfProxyNotTrusted(prod: boolean): boolean {
  if (!prod || isTrustProxyEnabled()) return false;
  logger.warn(
    "TRUST_PROXY o'rnatilmagan (production): barcha so'rovlar proxy IP'sidan kelgandek ko'rinadi — rate limit va login bloklash GLOBAL bo'lib qoladi. nginx ortida TRUST_PROXY=1 qo'ying.",
  );
  return true;
}

/** CORS_ORIGINS parsed to a list (empty if unset). Read lazily — never at import time. */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  return raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/**
 * WebSocket (Socket.IO) CORS origin check, same list as HTTP (CORS_ORIGINS).
 * Evaluated per handshake (env is read lazily, not at decoration time).
 * Production with an empty list fails closed (browser origins denied);
 * non-browser clients (no Origin header) pass, same as HTTP — the JWT check in
 * the gateway still applies.
 */
export function socketCorsOrigin(
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void {
  const list = getCorsOrigins();
  if (list.length === 0) {
    if (isProduction()) {
      cb(null, !origin);
      return;
    }
    cb(null, true);
    return;
  }
  cb(null, !origin || list.includes(origin));
}

export function buildCorsOptions(prod: boolean): CorsOptions {
  const list = getCorsOrigins();

  const common: Pick<
    CorsOptions,
    'credentials' | 'methods' | 'allowedHeaders'
  > = {
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
      "JWT_SECRET standart yoki yo'q — production'da kuchli tasodifiy qator qo'ying",
    );
  }
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || 'dev-secret-change-me';
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
export function enforceProductionAdminPassword(): void {
  if (!isProduction()) return;
  const pass = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (!pass || pass === 'admin123' || pass.length < 8) {
    throw new Error(
      "Production: INITIAL_ADMIN_PASSWORD majburiy va xavfsiz bo'lishi kerak (kamida 8 belgi, 'admin123' taqiqlangan)",
    );
  }
}
