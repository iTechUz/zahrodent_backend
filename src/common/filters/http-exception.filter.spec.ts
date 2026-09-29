import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let res: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const req = { url: '/patients/1', method: 'GET' };
    host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    } as unknown as ArgumentsHost;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const body = () => res.json.mock.calls[0][0];

  it('HttpException — status va Uzbek xabar saqlanadi', () => {
    filter.catch(new NotFoundException('Foydalanuvchi topilmadi'), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body()).toEqual({
      success: false,
      statusCode: 404,
      message: 'Foydalanuvchi topilmadi',
      path: '/patients/1',
      timestamp: expect.any(String),
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('validation xatolari massivi "; " bilan birlashtiriladi', () => {
    filter.catch(new BadRequestException(['phone: xato', 'age: xato']), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body().message).toBe('phone: xato; age: xato');
  });

  it('string response — o‘zi xabar bo‘ladi', () => {
    filter.catch(new HttpException('Oddiy xato', HttpStatus.CONFLICT), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(body().message).toBe('Oddiy xato');
  });

  it('object response message siz — default xabar', () => {
    filter.catch(new HttpException({ foo: 'bar' }, HttpStatus.FORBIDDEN), host);
    expect(body().message).toBe('Internal server error');
    expect(body().statusCode).toBe(403);
  });

  it('oddiy Error — 500, error log bilan stack', () => {
    const err = new Error('boom');
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body().statusCode).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /patients/1'),
      err.stack,
    );
  });

  it('Error bo‘lmagan qiymat — 500 va default xabar', () => {
    filter.catch('something', host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body().message).toBe('Internal server error');
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  // BUG (http-exception.filter.ts:34-35): non-HTTP errors (e.g. Prisma
  // errors with SQL/constraint details) have their raw `message` sent to the
  // client in the 500 response body. It should return a generic message and
  // only log the details.
  it.todo(
    'HttpException bo‘lmagan xatoning ichki xabari clientga chiqmasligi kerak',
  );
});
