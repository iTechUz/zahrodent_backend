import 'reflect-metadata';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: Record<
    'login' | 'refresh' | 'logout' | 'me' | 'changePassword',
    jest.Mock
  >;

  const req = (over: Record<string, unknown> = {}) =>
    ({
      header: jest.fn((name: string) =>
        name === 'user-agent' ? 'Mozilla/5.0' : undefined,
      ),
      ip: '10.0.0.5',
      ...over,
    }) as any;

  beforeEach(() => {
    service = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      me: jest.fn(),
      changePassword: jest.fn(),
    };
    controller = new AuthController(service as unknown as AuthService);
  });

  describe('login', () => {
    it('dto va sessiya meta (user-agent, ip) uzatiladi', async () => {
      const dto = { phone: '+998901234567', password: 'x' } as any;
      const out = { access_token: 'a', refresh_token: 'r' };
      service.login.mockResolvedValue(out);
      const r = req();
      await expect(controller.login(dto, r)).resolves.toBe(out);
      expect(r.header).toHaveBeenCalledWith('user-agent');
      expect(service.login).toHaveBeenCalledWith(dto, {
        userAgent: 'Mozilla/5.0',
        ip: '10.0.0.5',
      });
    });

    it('user-agent va ip yo‘q bo‘lsa — undefined', async () => {
      const r = req({ header: jest.fn(() => undefined), ip: undefined });
      await controller.login({} as any, r);
      expect(service.login).toHaveBeenCalledWith(
        {},
        { userAgent: undefined, ip: undefined },
      );
    });

    it('xato tarqaladi', async () => {
      service.login.mockRejectedValue(new Error('401'));
      await expect(controller.login({} as any, req())).rejects.toThrow('401');
    });
  });

  describe('refresh', () => {
    it('refresh_token va sessiya meta uzatiladi', async () => {
      service.refresh.mockResolvedValue({ access_token: 'n' });
      await expect(
        controller.refresh({ refresh_token: 'tok' }, req()),
      ).resolves.toEqual({ access_token: 'n' });
      expect(service.refresh).toHaveBeenCalledWith('tok', {
        userAgent: 'Mozilla/5.0',
        ip: '10.0.0.5',
      });
    });

    it('xato tarqaladi', async () => {
      service.refresh.mockRejectedValue(new Error('expired'));
      await expect(
        controller.refresh({ refresh_token: 't' }, req()),
      ).rejects.toThrow('expired');
    });
  });

  it('logout — faqat refresh_token uzatiladi', async () => {
    service.logout.mockResolvedValue({ success: true });
    await expect(controller.logout({ refresh_token: 'tok' })).resolves.toEqual({
      success: true,
    });
    expect(service.logout).toHaveBeenCalledWith('tok');
  });

  it('me — user uzatiladi', async () => {
    const user = { id: 'u1' } as any;
    service.me.mockResolvedValue({ user });
    await expect(controller.me(user)).resolves.toEqual({ user });
    expect(service.me).toHaveBeenCalledWith(user);
  });

  it('changePassword — userId va dto uzatiladi', async () => {
    const dto = { currentPassword: 'a', newPassword: 'bbbbbbbb' };
    service.changePassword.mockResolvedValue({ success: true });
    await expect(controller.changePassword('u1', dto)).resolves.toEqual({
      success: true,
    });
    expect(service.changePassword).toHaveBeenCalledWith('u1', dto);
  });

  it('changePassword — xato tarqaladi', async () => {
    service.changePassword.mockRejectedValue(new Error('wrong'));
    await expect(controller.changePassword('u1', {} as any)).rejects.toThrow(
      'wrong',
    );
  });

  describe('metadata', () => {
    const proto = AuthController.prototype;

    it('klass: ThrottlerGuard va 25/daqiqa', () => {
      expect(Reflect.getMetadata('__guards__', AuthController)).toEqual([
        ThrottlerGuard,
      ]);
      expect(
        Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController),
      ).toBe(25);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', AuthController)).toBe(
        60_000,
      );
    });

    it('refresh va logout — HTTP 200', () => {
      expect(Reflect.getMetadata('__httpCode__', proto.refresh)).toBe(200);
      expect(Reflect.getMetadata('__httpCode__', proto.logout)).toBe(200);
    });

    it('login — status kodi o‘zgartirilmagan (POST → 201)', () => {
      expect(Reflect.getMetadata('__httpCode__', proto.login)).toBeUndefined();
    });

    it('me va changePassword — JwtAuthGuard; login/refresh/logout — ochiq', () => {
      expect(Reflect.getMetadata('__guards__', proto.me)).toEqual([
        JwtAuthGuard,
      ]);
      expect(Reflect.getMetadata('__guards__', proto.changePassword)).toEqual([
        JwtAuthGuard,
      ]);
      for (const m of ['login', 'refresh', 'logout'] as const) {
        expect(Reflect.getMetadata('__guards__', proto[m])).toBeUndefined();
      }
    });

    it('throttle: refresh 30, password 10', () => {
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', proto.refresh)).toBe(
        30,
      );
      expect(
        Reflect.getMetadata('THROTTLER:LIMITdefault', proto.changePassword),
      ).toBe(10);
    });
  });
});
