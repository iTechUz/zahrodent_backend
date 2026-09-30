import type { Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';
import { getRequestId } from '../logging/request-context';

describe('requestIdMiddleware', () => {
  const run = (header?: string) => {
    const req = {
      header: jest.fn().mockReturnValue(header),
    } as unknown as Request & { requestId?: string };
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();
    requestIdMiddleware(req, res, next);
    return { req, res, next };
  };

  it('header dagi id qayta ishlatiladi (trim bilan)', () => {
    const { req, res, next } = run('  abc-123  ');
    expect(req.requestId).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('header yo‘q — yangi UUID', () => {
    const { req, res } = run(undefined);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
  });

  it('bo‘sh header — yangi UUID', () => {
    const { req } = run('   ');
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('128 belgidan uzun header — yangi UUID', () => {
    const long = 'x'.repeat(129);
    const { req } = run(long);
    expect(req.requestId).not.toBe(long);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('aynan 128 belgi — qabul qilinadi', () => {
    const exact = 'y'.repeat(128);
    expect(run(exact).req.requestId).toBe(exact);
  });

  it('xavfsiz bo‘lmagan belgilar yoki 128 dan uzun — yangi UUID', () => {
    expect(run('abc def').req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(run('a"b').req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(run('x'.repeat(129)).req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(run('x'.repeat(128)).req.requestId).toBe('x'.repeat(128));
  });

  it('next() request context ichida chaqiriladi (loglar uchun)', () => {
    const req = {
      header: jest.fn().mockReturnValue('ctx-1'),
    } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    let seen: string | undefined;
    requestIdMiddleware(req, res, () => {
      seen = getRequestId();
    });
    expect(seen).toBe('ctx-1');
    expect(getRequestId()).toBeUndefined();
  });
});
