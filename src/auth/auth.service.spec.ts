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
  let usersRepository: jest.Mocked<
    Pick<UsersRepository, 'findByPhone' | 'findDoctorByUserId' | 'findAuthById'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(() => {
    usersRepository = {
      findByPhone: jest.fn(),
      findDoctorByUserId: jest.fn(),
      findAuthById: jest.fn(),
    };
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
});
