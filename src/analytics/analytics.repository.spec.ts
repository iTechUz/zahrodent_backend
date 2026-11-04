import { AnalyticsRepository } from './analytics.repository';
import { PrismaService } from '../database/prisma.service';

describe('AnalyticsRepository', () => {
  let prisma: any;
  let repo: AnalyticsRepository;

  beforeEach(() => {
    prisma = {
      patient: { count: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
      booking: { count: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
      doctor: { count: jest.fn() },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ total: 10, count: 1 }]),
    };
    repo = new AnalyticsRepository(prisma as PrismaService);
  });

  it('sumPayments — null → 0', async () => {
    await expect(repo.sumPayments({ type: 'INCOME' })).resolves.toBe(0);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { type: 'INCOME' },
      _sum: { amount: true },
    });
  });

  it('getDebtSummary — raw SQL', async () => {
    await expect(repo.getDebtSummary()).resolves.toEqual({
      total: 10,
      count: 1,
    });
  });

  it('groupBy natijalari tekis ko‘rinishga', async () => {
    prisma.booking.groupBy.mockResolvedValueOnce([
      { source: 'phone', _count: { _all: 4 } },
    ]);
    await expect(repo.bookingsBySource({ doctorId: 'd1' })).resolves.toEqual([
      { source: 'phone', count: 4 },
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith({
      by: ['source'],
      where: { doctorId: 'd1' },
      _count: { _all: true },
    });

    const day = new Date('2026-09-01T00:00:00.000Z');
    prisma.payment.groupBy.mockResolvedValueOnce([
      { date: day, type: 'INCOME', _sum: { amount: null } },
    ]);
    await expect(repo.paymentsPerDayAndType({})).resolves.toEqual([
      { date: day, type: 'INCOME', amount: 0 },
    ]);

    prisma.patient.groupBy.mockResolvedValueOnce([
      { createdAt: day, _count: { _all: 2 } },
    ]);
    await expect(repo.patientsPerDay({})).resolves.toEqual([
      { date: day, count: 2 },
    ]);
  });

  it('countPatients / countBookings — where uzatiladi', async () => {
    prisma.patient.count.mockResolvedValue(5);
    prisma.booking.count.mockResolvedValue(8);
    await expect(repo.countPatients({ deletedAt: null })).resolves.toBe(5);
    await expect(repo.countBookings({ doctorId: 'd1' })).resolves.toBe(8);
    expect(prisma.patient.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { doctorId: 'd1' },
    });
  });

  it('countDoctors — where berilmasa bo‘sh obyekt', async () => {
    prisma.doctor.count.mockResolvedValue(4);
    await expect(repo.countDoctors()).resolves.toBe(4);
    expect(prisma.doctor.count).toHaveBeenCalledWith({ where: {} });
    await repo.countDoctors({ id: 'd1' });
    expect(prisma.doctor.count).toHaveBeenLastCalledWith({
      where: { id: 'd1' },
    });
  });

  it('sumPayments — yig‘indi qaytadi', async () => {
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 1500 } });
    await expect(repo.sumPayments({})).resolves.toBe(1500);
  });

  it('getDebtSummary — qatorlar bo‘sh bo‘lsa 0/0, satrli qiymatlar songa', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(repo.getDebtSummary()).resolves.toEqual({
      total: 0,
      count: 0,
    });
    prisma.$queryRaw.mockResolvedValueOnce([{ total: '2500', count: '3' }]);
    await expect(repo.getDebtSummary()).resolves.toEqual({
      total: 2500,
      count: 3,
    });
  });

  it('bookingsPerDayAndStatus — sana+status bo‘yicha tekis ko‘rinish', async () => {
    const day = new Date('2026-09-01T00:00:00.000Z');
    prisma.booking.groupBy.mockResolvedValueOnce([
      { date: day, status: 'confirmed', _count: { _all: 3 } },
      { date: day, status: 'cancelled', _count: { _all: 1 } },
    ]);
    await expect(
      repo.bookingsPerDayAndStatus({ doctorId: 'd1' }),
    ).resolves.toEqual([
      { date: day, status: 'confirmed', count: 3 },
      { date: day, status: 'cancelled', count: 1 },
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith({
      by: ['date', 'status'],
      where: { doctorId: 'd1' },
      _count: { _all: true },
    });
  });

  it('patientsBySource — manba bo‘yicha tekis ko‘rinish', async () => {
    prisma.patient.groupBy.mockResolvedValueOnce([
      { source: 'instagram', _count: { _all: 6 } },
      { source: null, _count: { _all: 2 } },
    ]);
    await expect(repo.patientsBySource({ deletedAt: null })).resolves.toEqual([
      { source: 'instagram', count: 6 },
      { source: null, count: 2 },
    ]);
    expect(prisma.patient.groupBy).toHaveBeenCalledWith({
      by: ['source'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
  });
});
