import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, AuthUserView } from '../auth.service';

describe('JwtStrategy.validate', () => {
  const view: AuthUserView = {
    id: 'u1',
    name: 'Dr',
    phone: '+998901234567',
    role: 'doctor',
    doctorId: 'd1',
  };
  let authService: { resolveTokenUser: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    authService = { resolveTokenUser: jest.fn() };
    strategy = new JwtStrategy(authService as unknown as AuthService);
  });

  it('har so‘rovda user DB dan qayta o‘qiladi', async () => {
    authService.resolveTokenUser.mockResolvedValue(view);
    const payload = { sub: 'u1', role: 'doctor', phone: 'p', name: 'Dr' };
    await expect(strategy.validate(payload)).resolves.toEqual(view);
    expect(authService.resolveTokenUser).toHaveBeenCalledWith(payload);
  });

  it('eski/noto‘g‘ri payload yoki o‘chirilgan user — 401 Uzbek xabar', async () => {
    authService.resolveTokenUser.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 'gone' })).rejects.toThrow(
      new UnauthorizedException('Token yangilanishi kerak — qayta kiring'),
    );
  });
});
