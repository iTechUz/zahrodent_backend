import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';

type User = NonNullable<Awaited<ReturnType<UsersRepository['findByPhone']>>>;

function mockUser(partial: Partial<User>): User {
  const now = new Date();
  return {
    id: 'u1',
    name: 'U',
    phone: '+998901234567',
    passwordHash: 'h',
    role: 'admin',
    specialty: null,
    avatar: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findByPhone'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(() => {
    usersRepository = { findByPhone: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    service = new AuthService(
      usersRepository as unknown as UsersRepository,
      jwtService as unknown as JwtService,
    );
  });

  it('login — foydalanuvchi yo‘q → 401', async () => {
    usersRepository.findByPhone.mockResolvedValue(null);
    await expect(
      service.login({ phone: '+998900000000', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login — parol noto‘g‘ri → 401', async () => {
    usersRepository.findByPhone.mockResolvedValue(
      mockUser({
        phone: '+998901234567',
        passwordHash: await bcrypt.hash('right', 4),
      }),
    );
    await expect(
      service.login({ phone: '+998901234567', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login — muvaffaqiyat', async () => {
    const hash = await bcrypt.hash('secret', 4);
    usersRepository.findByPhone.mockResolvedValue(
      mockUser({
        name: 'Admin',
        phone: '+998901234567',
        passwordHash: hash,
      }),
    );

    const out = await service.login({
      phone: '+998901234567',
      password: 'secret',
    });
    expect(out.access_token).toBe('signed-jwt');
    expect(out.user).toMatchObject({
      id: 'u1',
      phone: '+998901234567',
      role: 'admin',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: 'admin' }),
    );
  });
});
