import { VisitsRepository } from './visits.repository';
import { PrismaService } from '../database/prisma.service';

describe('VisitsRepository', () => {
  let prisma: any;
  let repo: VisitsRepository;

  beforeEach(() => {
    prisma = {
      visit: {
        findMany: jest.fn().mockResolvedValue([{ id: 'v1' }]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    repo = new VisitsRepository(prisma as PrismaService);
  });

  it('findAll — date desc, data+total', async () => {
    await expect(
      repo.findAll({ doctorId: 'd1' }, { skip: 0, take: 10 }),
    ).resolves.toEqual({ data: [{ id: 'v1' }], total: 1 });
    expect(prisma.visit.findMany).toHaveBeenCalledWith({
      where: { doctorId: 'd1' },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 10,
    });
    await repo.findAll();
    expect(prisma.visit.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: { date: 'desc' },
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.findById('v1');
    expect(prisma.visit.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
    });
    await repo.create({ status: 'completed' } as any);
    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: { status: 'completed' },
    });
    await repo.update('v1', { price: 1 });
    expect(prisma.visit.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { price: 1 },
    });
  });
});
