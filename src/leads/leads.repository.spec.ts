import { LeadsRepository } from './leads.repository';
import { PrismaService } from '../database/prisma.service';

describe('LeadsRepository', () => {
  let prisma: any;
  let repo: LeadsRepository;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
      lead: {
        findMany: jest.fn().mockResolvedValue([{ id: 'l1' }]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repo = new LeadsRepository(prisma as PrismaService);
  });

  it('findAll — findMany+count bitta tranzaksiyada', async () => {
    await expect(
      repo.findAll({ skip: 0, take: 10, where: { status: 'new' } }),
    ).resolves.toEqual({ data: [{ id: 'l1' }], total: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 10,
      where: { status: 'new' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: { status: 'new' },
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.findById('l1');
    expect(prisma.lead.findUnique).toHaveBeenCalledWith({
      where: { id: 'l1' },
    });
    await repo.create({ name: 'A', phone: '1' });
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: { name: 'A', phone: '1' },
    });
    await repo.update('l1', { status: 'contacted' });
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { status: 'contacted' },
    });
    await repo.delete('l1');
    expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });
});
