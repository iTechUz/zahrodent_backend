import { PaymentsRepository } from './payments.repository';
import { PrismaService } from '../database/prisma.service';

describe('PaymentsRepository', () => {
  let prisma: any;
  let repo: PaymentsRepository;

  beforeEach(() => {
    prisma = {
      payment: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      visit: { findMany: jest.fn() },
    };
    repo = new PaymentsRepository(prisma as PrismaService);
  });

  it('findAll — date desc, pagination', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);
    await repo.findAll({ status: 'paid' }, { skip: 10, take: 10 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { status: 'paid' },
      orderBy: { date: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: { status: 'paid' },
    });
    await repo.findAll();
    expect(prisma.payment.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: { date: 'desc' },
    });
  });

  it('sumAmount — null → 0', async () => {
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 500 } });
    await expect(repo.sumAmount({ status: 'paid' })).resolves.toBe(500);
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } });
    await expect(repo.sumAmount({})).resolves.toBe(0);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { status: 'paid' },
      _sum: { amount: true },
    });
  });

  it('getDoctorStats — visit orqali doctorId ga yig‘adi', async () => {
    prisma.payment.groupBy.mockResolvedValue([
      { visitId: 'v1', _sum: { amount: 100 } },
      { visitId: 'v2', _sum: { amount: 50 } },
      { visitId: 'v3', _sum: { amount: 70 } },
      { visitId: 'v-orphan', _sum: { amount: 999 } },
      { visitId: null, _sum: { amount: 1 } },
      { visitId: 'v4', _sum: { amount: null } },
    ]);
    prisma.visit.findMany.mockResolvedValue([
      { id: 'v1', doctorId: 'd1' },
      { id: 'v2', doctorId: 'd1' },
      { id: 'v3', doctorId: 'd2' },
      { id: 'v4', doctorId: 'd2' },
    ]);
    await expect(repo.getDoctorStats()).resolves.toEqual([
      { doctorId: 'd1', total: 150 },
      { doctorId: 'd2', total: 70 },
    ]);
    expect(prisma.payment.groupBy).toHaveBeenCalledWith({
      by: ['visitId'],
      where: {
        type: 'INCOME',
        status: { in: ['paid', 'partial'] },
        visitId: { not: null },
      },
      _sum: { amount: true },
    });
    expect(prisma.visit.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['v1', 'v2', 'v3', 'v-orphan', 'v4'] } },
      select: { id: true, doctorId: true },
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.findById('x');
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id: 'x' },
    });
    await repo.create({ amount: 1 } as any);
    expect(prisma.payment.create).toHaveBeenCalledWith({ data: { amount: 1 } });
    await repo.update('x', { amount: 2 });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'x' },
      data: { amount: 2 },
    });
    await repo.delete('x');
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'x' } });
  });

  it('getDebtSummary — raw SQL natijasi raqamga aylanadi', async () => {
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValue([{ total: '1500', count: 2 }]);
    await expect(repo.getDebtSummary()).resolves.toEqual({
      total: 1500,
      count: 2,
    });
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.getDebtSummary()).resolves.toEqual({
      total: 0,
      count: 0,
    });
  });

  it('findVisitOwner — faqat id va patientId', async () => {
    prisma.visit.findUnique = jest.fn().mockResolvedValue(null);
    await repo.findVisitOwner('v1');
    expect(prisma.visit.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { id: true, patientId: true },
    });
  });
});
