import { Logger } from '@nestjs/common';
import { EskizService } from './eskiz.service';

type FakeRes = { ok: boolean; status: number; text: () => Promise<string> };
const res = (status: number, body: unknown): FakeRes => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const ENV = [
  'ESKIZ_EMAIL',
  'ESKIZ_PASSWORD',
  'ESKIZ_BASE_URL',
  'ESKIZ_FROM',
  'ESKIZ_HTTP_TIMEOUT_MS',
] as const;

describe('EskizService', () => {
  const saved: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    for (const k of ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    fetchMock = jest.spyOn(global, 'fetch' as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  const configure = () => {
    process.env.ESKIZ_EMAIL = 'a@b.uz';
    process.env.ESKIZ_PASSWORD = 'pw';
  };

  describe('isConfigured', () => {
    it('email va parol bo‘lsa true', () => {
      const s = new EskizService();
      expect(s.isConfigured()).toBe(false);
      process.env.ESKIZ_EMAIL = 'a@b.uz';
      expect(s.isConfigured()).toBe(false);
      process.env.ESKIZ_PASSWORD = '  ';
      expect(s.isConfigured()).toBe(false);
      process.env.ESKIZ_PASSWORD = 'pw';
      expect(s.isConfigured()).toBe(true);
    });
  });

  describe('normalizeMobile', () => {
    const s = new EskizService();
    it.each([
      ['+998901112233', '998901112233'],
      ['+998 (90) 111-22-33', '998901112233'],
      ['998901112233', '998901112233'],
      ['901112233', '998901112233'],
      ['90 111 22 33', '998901112233'],
    ])('%s → %s', (input, out) => {
      expect(s.normalizeMobile(input)).toBe(out);
    });

    it.each(['', '12345', '801112233', '997901112233', '+99890111223344'])(
      '%s → null',
      (input) => {
        expect(s.normalizeMobile(input)).toBeNull();
      },
    );
  });

  describe('sendSms', () => {
    it('sozlanmagan — fetch siz xato', async () => {
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'Eskiz sozlanmagan',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('login + yuborish, token keshlanadi', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'T1' } }))
        .mockResolvedValueOnce(res(200, { status: 'waiting' }))
        .mockResolvedValueOnce(res(200, { status: 'waiting' }));
      const s = new EskizService();

      await expect(s.sendSms('998901112233', 'Salom')).resolves.toEqual({
        ok: true,
      });
      await expect(s.sendSms('998901112233', 'Yana')).resolves.toEqual({
        ok: true,
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [loginUrl, loginInit] = fetchMock.mock.calls[0];
      expect(loginUrl).toBe('https://notify.eskiz.uz/api/auth/login');
      expect(loginInit.method).toBe('POST');
      expect(JSON.parse(loginInit.body)).toEqual({
        email: 'a@b.uz',
        password: 'pw',
      });
      expect(loginInit.signal).toBeDefined();

      const [smsUrl, smsInit] = fetchMock.mock.calls[1];
      expect(smsUrl).toBe('https://notify.eskiz.uz/api/message/sms/send');
      expect(smsInit.headers.Authorization).toBe('Bearer T1');
      expect(JSON.parse(smsInit.body)).toEqual({
        mobile_phone: '998901112233',
        message: 'Salom',
        from: '4546',
      });
      expect(fetchMock.mock.calls[2][0]).toContain('/sms/send');
    });

    it('base URL (oxiridagi / siz) va FROM env dan', async () => {
      configure();
      process.env.ESKIZ_BASE_URL = 'https://mock.eskiz.test/';
      process.env.ESKIZ_FROM = 'ZAHRO';
      fetchMock
        .mockResolvedValueOnce(res(200, { token: 'T2' }))
        .mockResolvedValueOnce(res(200, {}));
      const s = new EskizService();
      await s.sendSms('998901112233', 'x');
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://mock.eskiz.test/api/auth/login',
      );
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        'Bearer T2',
      );
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).from).toBe('ZAHRO');
    });

    it('401 — token yangilanib bir marta qayta uriniladi', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'OLD' } }))
        .mockResolvedValueOnce(res(401, 'expired'))
        .mockResolvedValueOnce(res(200, { data: { token: 'NEW' } }))
        .mockResolvedValueOnce(res(200, {}));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe(
        'Bearer NEW',
      );
    });

    it('ketma-ket 401 — cheksiz sikl yo‘q, xato qaytadi', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'A' } }))
        .mockResolvedValueOnce(res(401, 'no'))
        .mockResolvedValueOnce(res(200, { data: { token: 'B' } }))
        .mockResolvedValueOnce(res(401, 'still no'));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'HTTP 401: still no',
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('SMS HTTP xato — ok:false va qisqartirilgan matn', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'T' } }))
        .mockResolvedValueOnce(res(500, 'x'.repeat(500)));
      const s = new EskizService();
      const out = await s.sendSms('998901112233', 'x');
      expect(out.ok).toBe(false);
      expect((out as any).error).toBe(`HTTP 500: ${'x'.repeat(200)}`);
    });

    it('login HTTP xato — ok:false', async () => {
      configure();
      fetchMock.mockResolvedValueOnce(res(403, 'bad creds'));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'Eskiz login: HTTP 403',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('login — JSON noto‘g‘ri', async () => {
      configure();
      fetchMock.mockResolvedValueOnce(res(200, '<html>'));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'Eskiz login: noto‘g‘ri JSON',
      });
    });

    it('login — token yo‘q', async () => {
      configure();
      fetchMock.mockResolvedValueOnce(res(200, { data: {} }));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'Eskiz login: token topilmadi',
      });
    });

    it('login — fetch reject bo‘lsa ok:false (getToken try/catch ichida)', async () => {
      configure();
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'ECONNREFUSED',
      });
    });

    it('login — Error bo‘lmagan reject ham stringga aylanadi', async () => {
      configure();
      fetchMock.mockRejectedValueOnce('boom');
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'boom',
      });
    });

    it('timeout — AbortController signal abort qilinadi', async () => {
      configure();
      process.env.ESKIZ_HTTP_TIMEOUT_MS = '10';
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      );
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'aborted',
      });
    });

    // Fixed: the SMS-send fetch was outside any try/catch, so a network
    // error or timeout made sendSms() reject and aborted whole batches.
    it('sendSms — SMS so‘rovida tarmoq xatosi bo‘lsa { ok: false } qaytaradi', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'T' } }))
        .mockRejectedValueOnce(new TypeError('fetch failed'));
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'fetch failed',
      });
    });

    it('sendSms — SMS so‘rovi timeout (AbortError) → { ok: false, timeout }', async () => {
      configure();
      process.env.ESKIZ_HTTP_TIMEOUT_MS = '10';
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'T' } }))
        .mockImplementationOnce(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal!.addEventListener('abort', () => {
                const e = new Error('This operation was aborted');
                e.name = 'AbortError';
                reject(e);
              });
            }),
        );
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: false,
        error: 'timeout (10 ms)',
      });
    });

    it('sendSms — 2xx dan keyin tanani o‘qish xatosi — baribir ok (qayta yuborilmaydi)', async () => {
      configure();
      fetchMock
        .mockResolvedValueOnce(res(200, { data: { token: 'T' } }))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => {
            throw new Error('socket closed');
          },
        });
      const s = new EskizService();
      await expect(s.sendSms('998901112233', 'x')).resolves.toEqual({
        ok: true,
      });
    });
  });
});
