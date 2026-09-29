import { Logger } from '@nestjs/common';
import {
  buildCorsOptions,
  enforceProductionAdminPassword,
  enforceProductionJwtSecret,
  getJwtSecret,
  getListenHost,
  getPublicBaseUrl,
  isProduction,
  isSwaggerEnabled,
  parsePort,
  warnWeakJwtSecret,
} from './env-config';

const KEYS = [
  'PORT',
  'HOST',
  'PUBLIC_BASE_URL',
  'NODE_ENV',
  'SWAGGER_ENABLED',
  'CORS_ORIGINS',
  'JWT_SECRET',
  'INITIAL_ADMIN_PASSWORD',
] as const;

describe('env-config', () => {
  const saved: Record<string, string | undefined> = {};
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  describe('parsePort', () => {
    it('default 3000', () => {
      expect(parsePort()).toBe(3000);
    });

    it('PORT o‘qiladi', () => {
      process.env.PORT = '8080';
      expect(parsePort()).toBe(8080);
    });

    it.each(['abc', '0', '65536', '-1'])('noto‘g‘ri PORT=%s — xato', (v) => {
      process.env.PORT = v;
      expect(() => parsePort()).toThrow(`Invalid PORT="${v}"`);
    });

    it('chegaraviy 1 va 65535 qabul qilinadi', () => {
      process.env.PORT = '1';
      expect(parsePort()).toBe(1);
      process.env.PORT = '65535';
      expect(parsePort()).toBe(65535);
    });
  });

  describe('getListenHost', () => {
    it('default 0.0.0.0', () => {
      expect(getListenHost()).toBe('0.0.0.0');
    });

    it('bo‘sh joylar default ga tushadi', () => {
      process.env.HOST = '   ';
      expect(getListenHost()).toBe('0.0.0.0');
    });

    it('HOST trim qilinadi', () => {
      process.env.HOST = ' 127.0.0.1 ';
      expect(getListenHost()).toBe('127.0.0.1');
    });
  });

  describe('getPublicBaseUrl', () => {
    it('default localhost:port', () => {
      expect(getPublicBaseUrl(4000)).toBe('http://localhost:4000');
    });

    it('PUBLIC_BASE_URL oxiridagi / olib tashlanadi', () => {
      process.env.PUBLIC_BASE_URL = ' https://api.example.com/ ';
      expect(getPublicBaseUrl(4000)).toBe('https://api.example.com');
    });
  });

  describe('isProduction', () => {
    it('faqat NODE_ENV=production da true', () => {
      expect(isProduction()).toBe(false);
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });
  });

  describe('isSwaggerEnabled', () => {
    it('env yo‘q — prod da o‘chiq, dev da yoqiq', () => {
      expect(isSwaggerEnabled(true)).toBe(false);
      expect(isSwaggerEnabled(false)).toBe(true);
    });

    it.each(['false', '0', 'FALSE', ' False '])('%s — o‘chiq', (v) => {
      process.env.SWAGGER_ENABLED = v;
      expect(isSwaggerEnabled(false)).toBe(false);
    });

    it.each(['true', '1', 'TRUE'])('%s — yoqiq (prod da ham)', (v) => {
      process.env.SWAGGER_ENABLED = v;
      expect(isSwaggerEnabled(true)).toBe(true);
    });

    it('noma’lum qiymat — prod ga qarab', () => {
      process.env.SWAGGER_ENABLED = 'maybe';
      expect(isSwaggerEnabled(true)).toBe(false);
      expect(isSwaggerEnabled(false)).toBe(true);
    });
  });

  describe('buildCorsOptions', () => {
    const callOrigin = (opts: any, origin: string | undefined) => {
      const cb = jest.fn();
      opts.origin(origin, cb);
      return cb.mock.calls[0];
    };

    it('ro‘yxat bo‘lsa — faqat ro‘yxatdagi origin', () => {
      process.env.CORS_ORIGINS = 'https://a.uz, https://b.uz ,,';
      const opts = buildCorsOptions(true);
      expect(opts.credentials).toBe(true);
      expect(opts.methods).toContain('PATCH');
      expect(opts.allowedHeaders).toEqual([
        'Content-Type',
        'Authorization',
        'Accept',
      ]);
      expect(callOrigin(opts, 'https://a.uz')).toEqual([null, true]);
      expect(callOrigin(opts, 'https://b.uz')).toEqual([null, true]);
      expect(callOrigin(opts, 'https://evil.uz')).toEqual([null, false]);
    });

    it('origin yo‘q (server-to-server) — ruxsat', () => {
      process.env.CORS_ORIGINS = 'https://a.uz';
      expect(callOrigin(buildCorsOptions(false), undefined)).toEqual([
        null,
        true,
      ]);
    });

    it('prod da CORS_ORIGINS bo‘sh — xato', () => {
      expect(() => buildCorsOptions(true)).toThrow(
        'Production: CORS_ORIGINS majburiy',
      );
    });

    it('prod da faqat vergullar — ham xato', () => {
      process.env.CORS_ORIGINS = ' , ,';
      expect(() => buildCorsOptions(true)).toThrow('CORS_ORIGINS majburiy');
    });

    it('dev da bo‘sh — origin: true va ogohlantirish', () => {
      const opts = buildCorsOptions(false);
      expect(opts.origin).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('warnWeakJwtSecret', () => {
    it('prod + secret yo‘q — ogohlantiradi', () => {
      warnWeakJwtSecret(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it.each([
      'change-me-in-production-use-long-random-string',
      'dev-secret-change-me',
    ])('prod + standart secret (%s) — ogohlantiradi', (s) => {
      process.env.JWT_SECRET = s;
      warnWeakJwtSecret(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('dev da jim', () => {
      warnWeakJwtSecret(false);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('prod + kuchli secret — jim', () => {
      process.env.JWT_SECRET = 'x'.repeat(40);
      warnWeakJwtSecret(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('getJwtSecret', () => {
    it('default dev-secret-change-me', () => {
      expect(getJwtSecret()).toBe('dev-secret-change-me');
      process.env.JWT_SECRET = '   ';
      expect(getJwtSecret()).toBe('dev-secret-change-me');
    });

    it('trim qilingan qiymat', () => {
      process.env.JWT_SECRET = '  abc  ';
      expect(getJwtSecret()).toBe('abc');
    });
  });

  describe('enforceProductionJwtSecret', () => {
    it('dev da hech narsa qilmaydi', () => {
      expect(() => enforceProductionJwtSecret()).not.toThrow();
    });

    it.each([
      undefined,
      'short',
      'change-me-in-production-use-long-random-string',
      'dev-secret-change-me',
    ])('prod + zaif secret (%s) — xato', (s) => {
      process.env.NODE_ENV = 'production';
      if (s !== undefined) process.env.JWT_SECRET = s;
      expect(() => enforceProductionJwtSecret()).toThrow(
        'Production: JWT_SECRET majburiy',
      );
    });

    it('prod + 32+ belgili secret — o‘tadi', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(32);
      expect(() => enforceProductionJwtSecret()).not.toThrow();
    });
  });

  describe('enforceProductionAdminPassword', () => {
    it('dev da hech narsa qilmaydi', () => {
      expect(() => enforceProductionAdminPassword()).not.toThrow();
    });

    it.each([undefined, 'admin123', 'short7!'])(
      'prod + zaif parol (%s) — xato',
      (p) => {
        process.env.NODE_ENV = 'production';
        if (p !== undefined) process.env.INITIAL_ADMIN_PASSWORD = p;
        expect(() => enforceProductionAdminPassword()).toThrow(
          'Production: INITIAL_ADMIN_PASSWORD majburiy',
        );
      },
    );

    it('prod + kuchli parol — o‘tadi', () => {
      process.env.NODE_ENV = 'production';
      process.env.INITIAL_ADMIN_PASSWORD = 'S3cure-pass';
      expect(() => enforceProductionAdminPassword()).not.toThrow();
    });
  });
});
