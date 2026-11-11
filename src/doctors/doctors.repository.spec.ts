import { DoctorsRepository } from './doctors.repository';
import { PrismaService } from '../database/prisma.service';

describe('DoctorsRepository', () => {
  let prisma: any;
  let repo: DoctorsRepository;

  beforeEach(() => {
    prisma = {
      doctor: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      visit: { count: jest.fn(), groupBy: jest.fn() },
      booking: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    repo = new DoctorsRepository(prisma as PrismaService);
  });

  afterEach(() => jest.useRealTimers());

  it('findAll — skip/take bilan va ularsiz', async () => {
    prisma.doctor.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.doctor.count.mockResolvedValue(1);
    await expect(
      repo.findAll({ specialty: 'X' }, { skip: 0, take: 5 }),
    ).resolves.toEqual({ data: [{ id: 'd1' }], total: 1 });
    expect(prisma.doctor.findMany).toHaveBeenCalledWith({
      where: { specialty: 'X' },
      orderBy: [{ firstName: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 5,
    });
    await repo.findAll();
    expect(prisma.doctor.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: [{ firstName: 'asc' }, { id: 'asc' }],
    });
  });

  it('count / getTotalVisitsCount', async () => {
    prisma.doctor.count.mockResolvedValue(3);
    prisma.visit.count.mockResolvedValue(9);
    prisma.booking.count.mockResolvedValue(2);
    await expect(repo.count()).resolves.toBe(3);
    // completed visits + completed bookings without a completed visit
    await expect(repo.getTotalVisitsCount()).resolves.toEqual({ count: 11 });
    expect(prisma.visit.count).toHaveBeenCalledWith({
      where: { status: 'completed' },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { status: 'completed', visits: { none: { status: 'completed' } } },
    });
  });

  it('getActiveCountToday — Toshkent buguni, bekor/kelmagan hisobga olinmaydi', async () => {
    // 2026-06-17 20:00 UTC == 2026-06-18 01:00 Tashkent
    jest.useFakeTimers({ now: new Date('2026-06-17T20:00:00.000Z') });
    prisma.doctor.count.mockResolvedValue(2);
    await expect(repo.getActiveCountToday()).resolves.toEqual({ count: 2 });
    expect(prisma.doctor.count).toHaveBeenCalledWith({
      where: {
        bookings: {
          some: {
            date: new Date('2026-06-18T00:00:00.000Z'),
            status: { notIn: ['cancelled', 'no-show'] },
          },
        },
      },
    });
  });

  it('findById/create/update/delete — user.phone include bilan', async () => {
    const include = { user: { select: { phone: true } } };
    await repo.findById('d1');
    expect(prisma.doctor.findUnique).toHaveBeenCalledWith({
      where: { id: 'd1' },
      include,
    });
    await repo.create({ firstName: 'A' } as any);
    expect(prisma.doctor.create).toHaveBeenCalledWith({
      data: { firstName: 'A' },
      include,
    });
    await repo.update('d1', { firstName: 'B' });
    expect(prisma.doctor.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { firstName: 'B' },
      include,
    });
    await repo.delete('d1');
    expect(prisma.doctor.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('getDetailedEfficiencyStats — booking/visit/unique patient agregatsiyasi', async () => {
    prisma.doctor.findMany.mockResolvedValue([
      { id: 'd1', firstName: 'A', lastName: 'B', specialty: 'S', phone: '1' },
      { id: 'd2', firstName: 'C', lastName: 'D', specialty: 'S', phone: '2' },
    ]);
    // non-cancelled bookings per doctor/status: d1 = 2 pending + 1 arrived + 2 completed
    prisma.booking.groupBy.mockResolvedValue([
      { doctorId: 'd1', status: 'pending', _count: { id: 2 } },
      { doctorId: 'd1', status: 'arrived', _count: { id: 1 } },
      { doctorId: 'd1', status: 'completed', _count: { id: 2 } },
    ]);
    // completed bookings that never got a Visit: still count for the doctor
    prisma.booking.findMany.mockResolvedValue([
      { doctorId: 'd1', patientId: 'p3' },
      { doctorId: 'd2', patientId: 'p4' },
      { doctorId: 'd2', patientId: 'p4' },
    ]);
    prisma.visit.groupBy
      .mockResolvedValueOnce([
        { doctorId: 'd1', _count: { id: 3 }, _sum: { price: 600 } },
      ])
      .mockResolvedValueOnce([
        { doctorId: 'd1', patientId: 'p1' },
        { doctorId: 'd1', patientId: 'p2' },
        { doctorId: 'd1', patientId: 'p1' },
      ]);

    await expect(repo.getDetailedEfficiencyStats()).resolves.toEqual([
      {
        id: 'd1',
        firstName: 'A',
        lastName: 'B',
        specialty: 'S',
        phone: '1',
        totalBookings: 5,
        completedBookings: 2,
        totalVisits: 4,
        uniquePatients: 3,
        totalRevenue: 600,
      },
      {
        id: 'd2',
        firstName: 'C',
        lastName: 'D',
        specialty: 'S',
        phone: '2',
        totalBookings: 0,
        completedBookings: 0,
        totalVisits: 2,
        uniquePatients: 1,
        totalRevenue: 0,
      },
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patient: { deletedAt: null },
          status: { not: 'cancelled' },
        },
      }),
    );
    expect(prisma.visit.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { patient: { deletedAt: null }, status: 'completed' },
      }),
    );
  });

  it('getDetailedEfficiencyStats — davr berilsa booking/visit sana bo‘yicha filtrlanadi', async () => {
    prisma.doctor.findMany.mockResolvedValue([]);
    prisma.booking.groupBy.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.visit.groupBy.mockResolvedValue([]);
    const range = {
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lte: new Date('2026-10-31T00:00:00.000Z'),
    };
    await repo.getDetailedEfficiencyStats(range);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patient: { deletedAt: null },
          status: { not: 'cancelled' },
          date: range,
        },
      }),
    );
    for (const call of prisma.visit.groupBy.mock.calls) {
      expect(call[0].where).toEqual({
        patient: { deletedAt: null },
        status: 'completed',
        date: range,
      });
    }
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patient: { deletedAt: null },
          status: 'completed',
          visits: { none: { status: 'completed' } },
          date: range,
        },
      }),
    );
  });

  it('getDetailedEfficiencyStats — _sum.price null → 0', async () => {
    prisma.doctor.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.booking.groupBy.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.visit.groupBy
      .mockResolvedValueOnce([
        { doctorId: 'd1', _count: { id: 1 }, _sum: { price: null } },
      ])
      .mockResolvedValueOnce([]);
    const [s] = await repo.getDetailedEfficiencyStats();
    expect(s.totalRevenue).toBe(0);
    expect(s.totalVisits).toBe(1);
  });

  describe('tranzaksiyali yozuvlar', () => {
    let tx: any;
    beforeEach(() => {
      tx = {
        user: {
          create: jest.fn().mockResolvedValue({ id: 'u1' }),
          update: jest.fn(),
          delete: jest.fn(),
        },
        doctor: {
          create: jest.fn().mockResolvedValue({ id: 'd1' }),
          update: jest.fn().mockResolvedValue({ id: 'd1' }),
          delete: jest.fn(),
        },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(tx));
    });

    it('createWithUser — user va doctor bitta tranzaksiyada, connect bilan', async () => {
      await repo.createWithUser(
        { firstName: 'A' } as any,
        {
          name: 'A',
        } as any,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.create).toHaveBeenCalledWith({
        data: { name: 'A' },
        select: { id: true },
      });
      expect(tx.doctor.create).toHaveBeenCalledWith({
        data: { firstName: 'A', user: { connect: { id: 'u1' } } },
        include: { user: { select: { phone: true } } },
      });
      expect(prisma.doctor.create).not.toHaveBeenCalled();
    });

    it('createWithUser — doctor xatosi tranzaksiyani yiqitadi (user rollback)', async () => {
      tx.doctor.create.mockRejectedValue(new Error('boom'));
      await expect(
        repo.createWithUser({} as any, { name: 'A' } as any),
      ).rejects.toThrow('boom');
    });

    it('createWithUser — user siz', async () => {
      await repo.createWithUser({ firstName: 'A' } as any, null);
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('updateWithUser — mavjud user yangilanadi / yangi user yaratiladi', async () => {
      await repo.updateWithUser(
        'd1',
        { lastName: 'B' },
        {
          update: { id: 'u5', data: { name: 'X' } },
        },
      );
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u5' },
        data: { name: 'X' },
      });
      await repo.updateWithUser('d1', {}, { create: { name: 'N' } as any });
      expect(tx.doctor.update).toHaveBeenLastCalledWith({
        where: { id: 'd1' },
        data: { user: { connect: { id: 'u1' } } },
        include: { user: { select: { phone: true } } },
      });
    });

    it('updateWithUser — userActive berilsa login ham shu tranzaksiyada yoqiladi/o‘chiriladi', async () => {
      tx.doctor.update.mockResolvedValue({ id: 'd1', userId: 'u5' });
      await repo.updateWithUser('d1', { isActive: false }, null, false);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u5' },
        data: { isActive: false },
      });
      tx.user.update.mockClear();
      await repo.updateWithUser('d1', { lastName: 'B' }, null);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('deleteWithUser — avval doctor, keyin user, bitta tranzaksiyada', async () => {
      const order: string[] = [];
      tx.doctor.delete.mockImplementation(async () => order.push('doctor'));
      tx.user.delete.mockImplementation(async () => order.push('user'));
      await repo.deleteWithUser('d1', 'u5');
      expect(order).toEqual(['doctor', 'user']);
      await repo.deleteWithUser('d2', null);
      expect(tx.user.delete).toHaveBeenCalledTimes(1);
    });
  });

  it('countHistory — bookings va visits', async () => {
    prisma.booking.count = jest.fn().mockResolvedValue(2);
    prisma.visit.count.mockResolvedValue(1);
    await expect(repo.countHistory('d1')).resolves.toEqual({
      bookings: 2,
      visits: 1,
    });
  });
});
