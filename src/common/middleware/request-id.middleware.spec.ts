import type { Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

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
});
