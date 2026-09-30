import { UsersRepository } from './users.repository';
import { PrismaService } from '../database/prisma.service';

describe('UsersRepository', () => {
  let prisma: any;
  let repo: UsersRepository;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      doctor: { findUnique: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (fn: any) =>
      fn({
        user: { update: prisma.user.update },
        refreshToken: { updateMany: prisma.refreshToken.updateMany },
      }),
    );
    prisma.user.update = jest.fn().mockResolvedValue({});
    prisma.refreshToken = {
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    };
    repo = new UsersRepository(prisma as PrismaService);
  });

  it('findByPhone / findById', async () => {
    await repo.findByPhone('+998901234567');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { phone: '+998901234567' },
    });
    await repo.findById('u1');
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'u1' },
    });
  });

  it('findDoctorByUserId — faqat id tanlanadi', async () => {
    prisma.doctor.findUnique.mockResolvedValue({ id: 'd1' });
    await expect(repo.findDoctorByUserId('u1')).resolves.toEqual({ id: 'd1' });
    expect(prisma.doctor.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { id: true },
    });
  });

  it('updatePasswordAndRevokeSessions — bitta tranzaksiyada hash + revoke', async () => {
    await repo.updatePasswordAndRevokeSessions('u1', 'hash');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'hash' },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
