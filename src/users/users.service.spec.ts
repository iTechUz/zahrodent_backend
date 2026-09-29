import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (p: string) => `hashed:${p}`),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const publicSelect = {
    id: true,
    name: true,
    phone: true,
    role: true,
    specialty: true,
    avatar: true,
    createdAt: true,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
    (bcrypt.hash as jest.Mock).mockClear();
  });

  it('findAll — passwordHash tanlanmaydi, yangi birinchi', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    await expect(service.findAll()).resolves.toEqual([{ id: 'u1' }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('findOne', () => {
    it('topilsa qaytaradi', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.findOne('u1')).resolves.toEqual({ id: 'u1' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: publicSelect,
      });
    });

    it('topilmasa 404 Uzbek xabar', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(
        new NotFoundException('Foydalanuvchi topilmadi'),
      );
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Ali',
      phone: '+998901112233',
      password: 'secret1',
      role: 'receptionist',
    };

    it('telefon band — 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'other' });
      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(
          'Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud',
        ),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('parol hash qilinadi va ochiq parol saqlanmaydi', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1' });
      await service.create({ ...dto, specialty: 'X' });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret1', 10);
      const arg = prisma.user.create.mock.calls[0][0];
      expect(arg.data).toEqual({
        name: 'Ali',
        phone: '+998901112233',
        role: 'receptionist',
        specialty: 'X',
        passwordHash: 'hashed:secret1',
      });
      expect(arg.data).not.toHaveProperty('password');
      expect(arg.select).toEqual({
        id: true,
        name: true,
        phone: true,
        role: true,
      });
    });

    it('kiruvchi dto mutatsiya qilinmaydi', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const input = { ...dto };
      await service.create(input);
      expect(input.password).toBe('secret1');
    });
  });

  describe('update', () => {
    it('topilmasa 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('x', { name: 'N' })).rejects.toThrow(
        'Foydalanuvchi topilmadi',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('parolsiz — hash qilinmaydi', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({ id: 'u1' });
      await service.update('u1', { name: 'N' });
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'N' },
        select: { id: true, name: true, phone: true, role: true },
      });
    });

    it('parol bilan — passwordHash ga almashtiriladi', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await service.update('u1', { password: 'newpass' });
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        passwordHash: 'hashed:newpass',
      });
    });

    // BUG (users.service.ts:74-93): update() does not check phone uniqueness
    // like create() does, so changing a user's phone to one that already
    // exists surfaces Prisma P2002 as a 500 instead of a 409 ConflictException.
    it.todo(
      'update — boshqa userga tegishli telefon bo‘lsa 409 qaytarishi kerak',
    );
  });

  describe('remove', () => {
    it('topilmasa 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('o‘chiradi va id qaytaradi', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.remove('u1')).resolves.toEqual({ id: 'u1' });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
