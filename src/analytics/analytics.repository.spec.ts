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
});
