import { AppLogger, useJsonLogs } from './app-logger';
import { getRequestId, requestContext } from './request-context';

describe('useJsonLogs', () => {
  it('standart — production da json, boshqa joyda text; LOG_FORMAT ustun', () => {
    expect(useJsonLogs({ NODE_ENV: 'production' })).toBe(true);
    expect(useJsonLogs({ NODE_ENV: 'development' })).toBe(false);
    expect(useJsonLogs({})).toBe(false);
    expect(useJsonLogs({ NODE_ENV: 'production', LOG_FORMAT: 'text' })).toBe(
      false,
    );
    expect(useJsonLogs({ NODE_ENV: 'development', LOG_FORMAT: 'JSON' })).toBe(
      true,
    );
  });
});

describe('request context', () => {
  it('run ichida requestId, tashqarida undefined', () => {
    expect(getRequestId()).toBeUndefined();
    requestContext.run({ requestId: 'r1' }, () => {
      expect(getRequestId()).toBe('r1');
    });
  });

  it('async davomida ham saqlanadi', async () => {
    await requestContext.run({ requestId: 'r2' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      expect(getRequestId()).toBe('r2');
    });
  });
});

describe('AppLogger', () => {
  let out: jest.SpyInstance;
  let err: jest.SpyInstance;
  const lines = (spy: jest.SpyInstance) =>
    spy.mock.calls.map((c) => String(c[0]));

  beforeEach(() => {
    out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    err = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('json — bir qator JSON, requestId va context bilan', () => {
    const logger = new AppLogger(true);
    requestContext.run({ requestId: 'req-1' }, () => {
      logger.log('Salom', 'Test');
    });
    const [line] = lines(out);
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual({
      timestamp: expect.any(String),
      level: 'log',
      context: 'Test',
      requestId: 'req-1',
      message: 'Salom',
      pid: process.pid,
    });
  });

  it('json — request tashqarisida requestId yo‘q; obyekt xabar saqlanadi', () => {
    const logger = new AppLogger(true);
    logger.warn({ a: 1, big: BigInt(5) } as unknown as string, 'Ctx');
    const entry = JSON.parse(lines(out)[0]);
    expect(entry).not.toHaveProperty('requestId');
    expect(entry).toMatchObject({
      level: 'warn',
      message: { a: 1, big: '5' },
    });
  });

  it('json — error va stack bitta qatorda, stderr ga', () => {
    const logger = new AppLogger(true);
    requestContext.run({ requestId: 'req-2' }, () => {
      logger.error('Yiqildi', 'Error: x\n    at f (a.ts:1:1)', 'Filter');
    });
    expect(out).not.toHaveBeenCalled();
    const all = lines(err);
    expect(all).toHaveLength(1);
    expect(JSON.parse(all[0])).toMatchObject({
      level: 'error',
      context: 'Filter',
      requestId: 'req-2',
      message: 'Yiqildi',
      stack: 'Error: x\n    at f (a.ts:1:1)',
    });
  });

  it('json — stacksiz error ham chiqadi', () => {
    const logger = new AppLogger(true);
    logger.error('Faqat xabar');
    expect(JSON.parse(lines(err)[0])).toMatchObject({
      level: 'error',
      message: 'Faqat xabar',
    });
    expect(JSON.parse(lines(err)[0])).not.toHaveProperty('stack');
  });

  it('log darajalari hurmat qilinadi', () => {
    const logger = new AppLogger(true, ['error', 'warn', 'log']);
    logger.debug('yashirin');
    logger.verbose('yashirin');
    expect(out).not.toHaveBeenCalled();
  });

  it('text — [req:<id>] prefiksi', () => {
    const logger = new AppLogger(false);
    requestContext.run({ requestId: 'abc' }, () => logger.log('Salom', 'T'));
    logger.log('Tashqarida', 'T');
    const [inside, outside] = lines(out);
    expect(inside).toContain('[req:abc] Salom');
    expect(outside).toContain('Tashqarida');
    expect(outside).not.toContain('[req:');
  });
});
