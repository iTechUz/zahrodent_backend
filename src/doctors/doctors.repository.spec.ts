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
      booking: { groupBy: jest.fn() },
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
      orderBy: { firstName: 'asc' },
      skip: 0,
      take: 5,
    });
    await repo.findAll();
    expect(prisma.doctor.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: { firstName: 'asc' },
    });
  });

  it('count / getTotalVisitsCount', async () => {
    prisma.doctor.count.mockResolvedValue(3);
    prisma.visit.count.mockResolvedValue(9);
    await expect(repo.count()).resolves.toBe(3);
    await expect(repo.getTotalVisitsCount()).resolves.toEqual({ count: 9 });
  });

  it('getActiveCountToday — bugungi booking li shifokorlar', async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 17, 14, 0, 0) });
    prisma.doctor.count.mockResolvedValue(2);
    await expect(repo.getActiveCountToday()).resolves.toEqual({ count: 2 });
    expect(prisma.doctor.count).toHaveBeenCalledWith({
      where: {
        bookings: {
          some: {
            date: {
              gte: new Date(2026, 5, 17, 0, 0, 0, 0),
              lt: new Date(2026, 5, 18, 0, 0, 0, 0),
            },
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
    prisma.booking.groupBy.mockResolvedValue([
      { doctorId: 'd1', _count: { id: 5 } },
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
        totalVisits: 3,
        uniquePatients: 2,
        totalRevenue: 600,
      },
      {
        id: 'd2',
        firstName: 'C',
        lastName: 'D',
        specialty: 'S',
        phone: '2',
        totalBookings: 0,
        totalVisits: 0,
        uniquePatients: 0,
        totalRevenue: 0,
      },
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['pending', 'confirmed', 'completed'] } },
      }),
    );
    expect(prisma.visit.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { status: 'completed' } }),
    );
  });

  it('getDetailedEfficiencyStats — _sum.price null → 0', async () => {
    prisma.doctor.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.booking.groupBy.mockResolvedValue([]);
    prisma.visit.groupBy
      .mockResolvedValueOnce([
        { doctorId: 'd1', _count: { id: 1 }, _sum: { price: null } },
      ])
      .mockResolvedValueOnce([]);
    const [s] = await repo.getDetailedEfficiencyStats();
    expect(s.totalRevenue).toBe(0);
    expect(s.totalVisits).toBe(1);
  });
});
