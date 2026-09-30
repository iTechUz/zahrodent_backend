import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import {
  hashRefreshToken,
  RefreshTokensRepository,
} from './refresh-tokens.repository';

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
  let usersRepository: jest.Mocked<
    Pick<UsersRepository, 'findByPhone' | 'findDoctorByUserId' | 'findAuthById'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let refreshTokens: {
    findByHash: jest.Mock;
    create: jest.Mock;
    rotate: jest.Mock;
    revokeFamily: jest.Mock;
    revokeByHash: jest.Mock;
  };
  let extraUsers: {
    findById: jest.Mock;
    updatePasswordAndRevokeSessions: jest.Mock;
  };

  beforeEach(() => {
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_TTL_DAYS;
    usersRepository = {
      findByPhone: jest.fn(),
      findDoctorByUserId: jest.fn(),
      findAuthById: jest.fn(),
    };
    extraUsers = {
      findById: jest.fn(),
      updatePasswordAndRevokeSessions: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    refreshTokens = {
      findByHash: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'rt-new' }),
      rotate: jest.fn().mockResolvedValue({ id: 'rt-new' }),
      revokeFamily: jest.fn().mockResolvedValue(1),
      revokeByHash: jest.fn().mockResolvedValue(1),
    };
    service = new AuthService(
      { ...usersRepository, ...extraUsers } as unknown as UsersRepository,
      jwtService as unknown as JwtService,
      refreshTokens as unknown as RefreshTokensRepository,
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

  it('login — noma’lum telefon va noto‘g‘ri parol uchun bir xil Uzbek xabar', async () => {
    usersRepository.findByPhone.mockResolvedValue(null);
    await expect(
      service.login({ phone: '+998900000000', password: 'x' }),
    ).rejects.toThrow("Telefon raqami yoki parol noto'g'ri");

    usersRepository.findByPhone.mockResolvedValue(
      mockUser({ passwordHash: await bcrypt.hash('right', 4) }),
    );
    await expect(
      service.login({ phone: '+998901234567', password: 'wrong' }),
    ).rejects.toThrow("Telefon raqami yoki parol noto'g'ri");
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('login — admin uchun doctor yozuvi qidirilmaydi', async () => {
    usersRepository.findByPhone.mockResolvedValue(
      mockUser({ passwordHash: await bcrypt.hash('secret', 4) }),
    );
    const out = await service.login({
      phone: '+998901234567',
      password: 'secret',
    });
    expect(usersRepository.findDoctorByUserId).not.toHaveBeenCalled();
    expect(out.user.doctorId).toBeUndefined();
  });

  it('login — doctor roli uchun doctorId token va view ga qo‘shiladi', async () => {
    usersRepository.findByPhone.mockResolvedValue(
      mockUser({
        id: 'u9',
        role: 'doctor',
        specialty: 'Ortoped',
        avatar: 'x.png',
        passwordHash: await bcrypt.hash('secret', 4),
      }),
    );
    usersRepository.findDoctorByUserId.mockResolvedValue({ id: 'd9' });

    const out = await service.login({
      phone: '+998901234567',
      password: 'secret',
    });
    expect(usersRepository.findDoctorByUserId).toHaveBeenCalledWith('u9');
    expect(out.user).toEqual({
      id: 'u9',
      name: 'U',
      phone: '+998901234567',
      role: 'doctor',
      specialty: 'Ortoped',
      avatar: 'x.png',
      doctorId: 'd9',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'u9',
      role: 'doctor',
      phone: '+998901234567',
      name: 'U',
      specialty: 'Ortoped',
      avatar: 'x.png',
      doctorId: 'd9',
    });
  });

  it('login — doctor roli, lekin Doctor yozuvi yo‘q → doctorId undefined', async () => {
    usersRepository.findByPhone.mockResolvedValue(
      mockUser({
        role: 'doctor',
        passwordHash: await bcrypt.hash('secret', 4),
      }),
    );
    usersRepository.findDoctorByUserId.mockResolvedValue(null);
    const out = await service.login({
      phone: '+998901234567',
      password: 'secret',
    });
    expect(out.user.doctorId).toBeUndefined();
  });

  it('toUserView — null maydonlar undefined ga aylanadi', () => {
    expect(
      service.toUserView({
        id: 'u1',
        name: 'N',
        phone: 'p',
        role: 'receptionist',
        specialty: null,
        avatar: null,
      }),
    ).toEqual({
      id: 'u1',
      name: 'N',
      phone: 'p',
      role: 'receptionist',
      specialty: undefined,
      avatar: undefined,
      doctorId: undefined,
    });
  });

  describe('resolveTokenUser', () => {
    const payload = {
      sub: 'u9',
      role: 'doctor',
      phone: '+998901234567',
      name: 'Old name',
      doctorId: 'stale',
    };
    const dbUser = {
      id: 'u9',
      name: 'Dr New',
      phone: '+998901234567',
      role: 'doctor',
      specialty: null,
      avatar: null,
      doctor: { id: 'd9' },
    };

    it('DB dagi rol/doctorId ishlatiladi (token emas)', async () => {
      usersRepository.findAuthById.mockResolvedValue(dbUser as any);
      await expect(service.resolveTokenUser(payload)).resolves.toEqual({
        id: 'u9',
        name: 'Dr New',
        phone: '+998901234567',
        role: 'doctor',
        specialty: undefined,
        avatar: undefined,
        doctorId: 'd9',
      });
      expect(usersRepository.findAuthById).toHaveBeenCalledWith('u9');
    });

    it('rol o‘zgargan bo‘lsa yangi rol qo‘llanadi, doctorId faqat doctor uchun', async () => {
      usersRepository.findAuthById.mockResolvedValue({
        ...dbUser,
        role: 'receptionist',
      } as any);
      const out = await service.resolveTokenUser(payload);
      expect(out).toMatchObject({ role: 'receptionist' });
      expect(out?.doctorId).toBeUndefined();
    });

    it('user o‘chirilgan (token bekor) — null', async () => {
      usersRepository.findAuthById.mockResolvedValue(null);
      await expect(service.resolveTokenUser(payload)).resolves.toBeNull();
    });

    it('DB da noma’lum rol — null', async () => {
      usersRepository.findAuthById.mockResolvedValue({
        ...dbUser,
        role: 'superadmin',
      } as any);
      await expect(service.resolveTokenUser(payload)).resolves.toBeNull();
    });

    it.each([null, 'x', { ...payload, sub: 1 }, { ...payload, role: 'root' }])(
      'noto‘g‘ri payload %p — DB ga bormaydi',
      async (p) => {
        await expect(service.resolveTokenUser(p)).resolves.toBeNull();
        expect(usersRepository.findAuthById).not.toHaveBeenCalled();
      },
    );
  });

  describe('login — session', () => {
    beforeEach(async () => {
      usersRepository.findByPhone.mockResolvedValue(
        mockUser({ passwordHash: await bcrypt.hash('secret', 4) }),
      );
    });

    it('access + refresh + expires_in (standart 15m = 900)', async () => {
      const out = await service.login(
        { phone: '+998901234567', password: 'secret' },
        { userAgent: 'jest', ip: '127.0.0.1' },
      );
      expect(out.access_token).toBe('signed-jwt');
      expect(out.expires_in).toBe(900);
      expect(out.refresh_token).toMatch(/^[A-Za-z0-9_-]{64}$/);
      const data = refreshTokens.create.mock.calls[0][0];
      expect(data).toMatchObject({
        userId: 'u1',
        tokenHash: hashRefreshToken(out.refresh_token),
        userAgent: 'jest',
        ip: '127.0.0.1',
      });
      expect(data.tokenHash).not.toBe(out.refresh_token);
      expect(typeof data.familyId).toBe('string');
      const ttlDays = (data.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(ttlDays).toBeGreaterThan(29.9);
      expect(ttlDays).toBeLessThanOrEqual(30);
    });

    it('JWT_EXPIRES_IN va REFRESH_TOKEN_TTL_DAYS hisobga olinadi', async () => {
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.REFRESH_TOKEN_TTL_DAYS = '2';
      const out = await service.login({
        phone: '+998901234567',
        password: 'secret',
      });
      expect(out.expires_in).toBe(3600);
      const { expiresAt } = refreshTokens.create.mock.calls[0][0];
      expect(Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)).toBe(
        2,
      );
    });

    it('har login yangi family', async () => {
      await service.login({ phone: '+998901234567', password: 'secret' });
      await service.login({ phone: '+998901234567', password: 'secret' });
      const [a, b] = refreshTokens.create.mock.calls.map((c) => c[0]);
      expect(a.familyId).not.toBe(b.familyId);
      expect(a.tokenHash).not.toBe(b.tokenHash);
    });

    it('user agent / ip uzunligi cheklanadi', async () => {
      await service.login(
        { phone: '+998901234567', password: 'secret' },
        { userAgent: 'x'.repeat(2000), ip: '1'.repeat(200) },
      );
      const data = refreshTokens.create.mock.calls[0][0];
      expect(data.userAgent).toHaveLength(512);
      expect(data.ip).toHaveLength(64);
    });
  });

  describe('refresh', () => {
    const future = () => new Date(Date.now() + 86_400_000);
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'rt1',
      userId: 'u9',
      tokenHash: hashRefreshToken('tok'),
      familyId: 'fam1',
      expiresAt: future(),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date(),
      userAgent: null,
      ip: null,
      ...over,
    });
    const dbUser = {
      id: 'u9',
      name: 'Dr',
      phone: '+998901234567',
      role: 'doctor',
      specialty: null,
      avatar: null,
      doctor: { id: 'd9' },
    };

    it('rotation — eski bekor, yangi shu family da, javob login bilan bir xil', async () => {
      refreshTokens.findByHash.mockResolvedValue(row());
      usersRepository.findAuthById.mockResolvedValue(dbUser as any);

      const out = await service.refresh('tok', { ip: '1.2.3.4' });

      expect(refreshTokens.findByHash).toHaveBeenCalledWith(
        hashRefreshToken('tok'),
      );
      const [oldId, next] = refreshTokens.rotate.mock.calls[0];
      expect(oldId).toBe('rt1');
      expect(next).toMatchObject({
        userId: 'u9',
        familyId: 'fam1',
        ip: '1.2.3.4',
        tokenHash: hashRefreshToken(out.refresh_token),
      });
      expect(out).toMatchObject({
        access_token: 'signed-jwt',
        expires_in: 900,
        user: { id: 'u9', role: 'doctor', doctorId: 'd9' },
      });
      expect(out.refresh_token).not.toBe('tok');
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });

    it('noma’lum token — 401', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);
      await expect(service.refresh('nope')).rejects.toThrow(
        'Sessiya muddati tugagan, qayta kiring',
      );
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });

    it('muddati o‘tgan — 401, family bekor qilinmaydi', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        row({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.refresh('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });

    it('bekor qilingan token qayta ishlatilsa — butun family bekor, 401', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        row({ revokedAt: new Date(), replacedById: 'rt2' }),
      );
      await expect(service.refresh('tok')).rejects.toThrow(
        'Sessiya muddati tugagan, qayta kiring',
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(
        'fam1',
        expect.any(Date),
      );
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });

    it('parallel rotation yutqazildi (rotate → null) — family bekor, 401', async () => {
      refreshTokens.findByHash.mockResolvedValue(row());
      usersRepository.findAuthById.mockResolvedValue(dbUser as any);
      refreshTokens.rotate.mockResolvedValue(null);
      await expect(service.refresh('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(
        'fam1',
        expect.any(Date),
      );
    });

    it('user o‘chirilgan / rol noma’lum — family bekor, 401', async () => {
      refreshTokens.findByHash.mockResolvedValue(row());
      usersRepository.findAuthById.mockResolvedValue(null);
      await expect(service.refresh('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalled();
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('hash bo‘yicha bekor qiladi, {success:true}', async () => {
      await expect(service.logout('tok')).resolves.toEqual({ success: true });
      expect(refreshTokens.revokeByHash).toHaveBeenCalledWith(
        hashRefreshToken('tok'),
      );
    });

    it('idempotent — allaqachon bekor/noma’lum token ham success', async () => {
      refreshTokens.revokeByHash.mockResolvedValue(0);
      await expect(service.logout('tok')).resolves.toEqual({ success: true });
    });
  });

  describe('me', () => {
    it('doctor — doctorId bilan', () => {
      expect(
        service.me({
          id: 'u9',
          name: 'Dr',
          phone: 'p',
          role: 'doctor',
          specialty: 'x',
          doctorId: 'd9',
        }),
      ).toEqual({
        id: 'u9',
        name: 'Dr',
        phone: 'p',
        role: 'doctor',
        doctorId: 'd9',
      });
    });

    it('admin — doctorId null', () => {
      expect(
        service.me({ id: 'u1', name: 'A', phone: 'p', role: 'admin' }),
      ).toEqual({
        id: 'u1',
        name: 'A',
        phone: 'p',
        role: 'admin',
        doctorId: null,
      });
    });
  });

  describe('changePassword', () => {
    it('joriy parol noto‘g‘ri — 400 Uzbek xabar, hech narsa yozilmaydi', async () => {
      extraUsers.findById.mockResolvedValue(
        mockUser({ passwordHash: await bcrypt.hash('right', 4) }),
      );
      const p = service.changePassword('u1', {
        currentPassword: 'wrong',
        newPassword: 'new-password',
      });
      await expect(p).rejects.toBeInstanceOf(BadRequestException);
      await expect(p).rejects.toThrow("Joriy parol noto'g'ri");
      expect(extraUsers.updatePasswordAndRevokeSessions).not.toHaveBeenCalled();
    });

    it('muvaffaqiyat — yangi hash saqlanadi va sessiyalar bekor', async () => {
      extraUsers.findById.mockResolvedValue(
        mockUser({ passwordHash: await bcrypt.hash('right', 4) }),
      );
      await expect(
        service.changePassword('u1', {
          currentPassword: 'right',
          newPassword: 'new-password',
        }),
      ).resolves.toEqual({ success: true });
      const [id, hash] =
        extraUsers.updatePasswordAndRevokeSessions.mock.calls[0];
      expect(id).toBe('u1');
      await expect(bcrypt.compare('new-password', hash)).resolves.toBe(true);
    });

    it('user topilmadi — 401', async () => {
      extraUsers.findById.mockResolvedValue(null);
      await expect(
        service.changePassword('gone', {
          currentPassword: 'a',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
