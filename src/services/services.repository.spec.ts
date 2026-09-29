import { ServicesRepository } from './services.repository';
import { PrismaService } from '../database/prisma.service';

describe('ServicesRepository', () => {
  let prisma: any;
  let repo: ServicesRepository;

  beforeEach(() => {
    prisma = {
      service: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      payment: { groupBy: jest.fn() },
    };
    repo = new ServicesRepository(prisma as PrismaService);
  });

  it('findAll — category, name bo‘yicha saralash', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.count.mockResolvedValue(0);
    await repo.findAll({}, { skip: 0, take: 10 });
    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: 0,
      take: 10,
    });
    await repo.findAll();
    expect(prisma.service.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  });

  it('count / countCategories', async () => {
    prisma.service.count.mockResolvedValue(4);
    prisma.service.groupBy.mockResolvedValue([{}, {}, {}]);
    await expect(repo.count()).resolves.toBe(4);
    await expect(repo.countCategories()).resolves.toBe(3);
    expect(prisma.service.groupBy).toHaveBeenCalledWith({ by: ['category'] });
  });

  it('getAvgPrice — yaxlitlanadi, null → 0', async () => {
    prisma.service.aggregate.mockResolvedValueOnce({ _avg: { price: 1234.6 } });
    await expect(repo.getAvgPrice()).resolves.toBe(1235);
    prisma.service.aggregate.mockResolvedValueOnce({ _avg: { price: null } });
    await expect(repo.getAvgPrice()).resolves.toBe(0);
  });

  it('getDetailedStats — revenue va unikal bemorlar soni', async () => {
    prisma.payment.groupBy
      .mockResolvedValueOnce([
        { serviceId: 's1', _sum: { amount: 900 }, _count: { patientId: 3 } },
        { serviceId: 's2', _sum: { amount: null }, _count: { patientId: 0 } },
      ])
      .mockResolvedValueOnce([
        { serviceId: 's1', patientId: 'p1' },
        { serviceId: 's1', patientId: 'p2' },
        { serviceId: 's1', patientId: 'p1' },
        { serviceId: null, patientId: 'p9' },
      ]);
    await expect(repo.getDetailedStats()).resolves.toEqual([
      { serviceId: 's1', revenue: 900, patientCount: 2 },
      { serviceId: 's2', revenue: 0, patientCount: 0 },
    ]);
    expect(prisma.payment.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['serviceId'],
      where: { status: 'paid', serviceId: { not: null } },
      _sum: { amount: true },
      _count: { patientId: true },
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.findById('s1');
    expect(prisma.service.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
    await repo.create({ name: 'n' } as any);
    expect(prisma.service.create).toHaveBeenCalledWith({ data: { name: 'n' } });
    await repo.update('s1', { name: 'm' });
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { name: 'm' },
    });
    await repo.delete('s1');
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
