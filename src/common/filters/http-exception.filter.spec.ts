import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AllExceptionsFilter,
  INTERNAL_ERROR_MESSAGE,
} from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let res: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let req: { url: string; method: string };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    req = { url: '/patients/1', method: 'GET' };
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

  it('Error bo‘lmagan qiymat — 500 va umumiy Uzbek xabar', () => {
    filter.catch('something', host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body().message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  // Fixed: non-HTTP errors used to send their raw message (SQL/constraint
  // details) to the client.
  it('HttpException bo‘lmagan xatoning ichki xabari clientga chiqmaydi', () => {
    const err = new Error('relation "users" violates constraint xyz');
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body().message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body())).not.toContain('constraint');
    // …but the real message is logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('violates constraint xyz'),
      err.stack,
    );
  });

  describe('Prisma xatolari', () => {
    const prismaError = (code: string, message = 'secret sql detail') =>
      new Prisma.PrismaClientKnownRequestError(message, {
        code,
        clientVersion: '5.22.0',
      });

    it.each([
      ['P2002', 'POST', 409, 'Bunday qiymatli yozuv allaqachon mavjud'],
      ['P2025', 'PATCH', 404, "So'ralgan yoki bog'langan yozuv topilmadi"],
      ['P2003', 'POST', 400, "Bog'langan yozuv (id) mavjud emas"],
      [
        'P2003',
        'DELETE',
        409,
        "Yozuvni o'chirib bo'lmaydi: unga bog'langan boshqa yozuvlar mavjud",
      ],
      [
        'P2034',
        'PATCH',
        409,
        "Parallel o'zgarish aniqlandi — qayta urinib ko'ring",
      ],
    ])('%s (%s) → %i', (code, method, status, message) => {
      req.method = method;
      filter.catch(prismaError(code), host);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(body()).toMatchObject({ statusCode: status, message });
      expect(JSON.stringify(body())).not.toContain('secret sql detail');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(code));
    });

    it('noma’lum Prisma kodi — 500 umumiy xabar, tafsilot faqat logda', () => {
      filter.catch(prismaError('P1001', 'cannot reach db at 10.0.0.5'), host);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(body().message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot reach db at 10.0.0.5'),
        expect.any(String),
      );
    });
  });
});
