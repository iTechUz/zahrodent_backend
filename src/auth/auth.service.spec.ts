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
    Pick<UsersRepository, 'findByPhone' | 'findDoctorByUserId'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(() => {
    usersRepository = {
      findByPhone: jest.fn(),
      findDoctorByUserId: jest.fn(),
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

  it('login — xato xabarlari Uzbekcha', async () => {
    usersRepository.findByPhone.mockResolvedValue(null);
    await expect(
      service.login({ phone: '+998900000000', password: 'x' }),
    ).rejects.toThrow('Bunday telefon raqamli foydalanuvchi topilmadi');

    usersRepository.findByPhone.mockResolvedValue(
      mockUser({ passwordHash: await bcrypt.hash('right', 4) }),
    );
    await expect(
      service.login({ phone: '+998901234567', password: 'wrong' }),
    ).rejects.toThrow("Kiritilgan parol noto'g'ri");
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
});
