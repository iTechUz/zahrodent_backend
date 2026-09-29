import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard();

  it('user bo‘lsa qaytaradi', () => {
    const user = { id: 'u1' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('user yo‘q — 401', () => {
    expect(() => guard.handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.handleRequest(null, false)).toThrow(
      'Invalid or missing token',
    );
  });

  it('strategy xatosi o‘zi qayta tashlanadi', () => {
    const err = new UnauthorizedException('Token yangilanishi kerak');
    expect(() => guard.handleRequest(err, { id: 'u1' })).toThrow(err);
  });

  it('canActivate passport AuthGuard ga delegatsiya qiladi', () => {
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const spy = jest.spyOn(parent, 'canActivate').mockReturnValue(true);
    const ctx = {} as any;
    expect(guard.canActivate(ctx)).toBe(true);
    expect(spy).toHaveBeenCalledWith(ctx);
    spy.mockRestore();
  });
});
