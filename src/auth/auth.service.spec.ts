import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';

type User = NonNullable<Awaited<ReturnType<UsersRepository['findByEmail']>>>;

function mockUser(partial: Partial<User>): User {
  const now = new Date();
  return {
    id: 'u1',
    name: 'U',
    email: 'e@e.c',
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
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(() => {
    usersRepository = { findByEmail: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    service = new AuthService(
      usersRepository as unknown as UsersRepository,
      jwtService as unknown as JwtService,
    );
  });

  it('login — foydalanuvchi yo‘q → 401', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@b.c', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login — parol noto‘g‘ri → 401', async () => {
    usersRepository.findByEmail.mockResolvedValue(
      mockUser({
        email: 'a@b.c',
        passwordHash: await bcrypt.hash('right', 4),
      }),
    );
    await expect(
      service.login({ email: 'a@b.c', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login — muvaffaqiyat', async () => {
    const hash = await bcrypt.hash('secret', 4);
    usersRepository.findByEmail.mockResolvedValue(
      mockUser({
        name: 'Admin',
        email: 'admin@test',
        passwordHash: hash,
      }),
    );

    const out = await service.login({ email: 'admin@test', password: 'secret' });
    expect(out.access_token).toBe('signed-jwt');
    expect(out.user).toMatchObject({ id: 'u1', email: 'admin@test', role: 'admin' });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: 'admin' }),
    );
  });
});
