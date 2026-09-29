import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminInitService } from './admin-init.service';
import { PrismaService } from '../database/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (p: string) => `hashed:${p}`),
}));

describe('AdminInitService', () => {
  const ENV = [
    'INITIAL_ADMIN_PHONE',
    'INITIAL_ADMIN_PASSWORD',
    'INITIAL_ADMIN_NAME',
  ] as const;
  const saved: Record<string, string | undefined> = {};
  let prisma: { user: { count: jest.Mock; create: jest.Mock } };
  let service: AdminInitService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const k of ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    prisma = { user: { count: jest.fn(), create: jest.fn() } };
    service = new AdminInitService(prisma as unknown as PrismaService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    (bcrypt.hash as jest.Mock).mockClear();
  });

  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  it('admin bor — hech narsa yaratilmaydi', async () => {
    prisma.user.count.mockResolvedValue(2);
    await service.onModuleInit();
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: 'admin' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('admin yo‘q — default qiymatlar bilan yaratadi', async () => {
    prisma.user.count.mockResolvedValue(0);
    await service.onModuleInit();
    expect(bcrypt.hash).toHaveBeenCalledWith('admin123', 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Dr. Zahro Admin',
        phone: '+998901234567',
        passwordHash: 'hashed:admin123',
        role: 'admin',
      },
    });
  });

  it('admin yo‘q — env qiymatlari ishlatiladi', async () => {
    process.env.INITIAL_ADMIN_PHONE = '+998991112233';
    process.env.INITIAL_ADMIN_PASSWORD = 'Str0ngPass';
    process.env.INITIAL_ADMIN_NAME = 'Boss';
    prisma.user.count.mockResolvedValue(0);
    await service.onModuleInit();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Boss',
        phone: '+998991112233',
        passwordHash: 'hashed:Str0ngPass',
        role: 'admin',
      },
    });
  });

  it('create xatosi yutiladi va log qilinadi (ilova yiqilmaydi)', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockRejectedValue(new Error('unique'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Super adminni yaratishda xatolik:',
      expect.any(Error),
    );
  });
});
