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

  describe('createOrMerge', () => {
    let tx: any;
    const since = new Date('2026-01-01T00:00:00Z');
    beforeEach(() => {
      tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        lead: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'new' }),
          update: jest.fn().mockImplementation(async ({ data }) => ({
            id: 'old',
            ...data,
          })),
        },
      };
      prisma.$transaction = jest.fn(async (fn: (t: unknown) => unknown) =>
        fn(tx),
      );
    });

    it('locks per phone, then creates when no open lead exists', async () => {
      tx.lead.findFirst.mockResolvedValue(null);
      const merge = jest.fn();
      const r = await repo.createOrMerge(
        '+998901',
        since,
        { name: 'A' } as any,
        merge,
      );
      expect(r).toEqual({ lead: { id: 'new' }, created: true });
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.lead.findFirst.mock.calls[0][0].where).toEqual({
        phone: '+998901',
        createdAt: { gte: since },
        status: { notIn: ['converted', 'cancelled'] },
      });
      expect(merge).not.toHaveBeenCalled();
    });

    it('existing open lead → merge patch applied, no second row', async () => {
      tx.lead.findFirst.mockResolvedValue({ id: 'old' });
      const r = await repo.createOrMerge('+998901', since, {} as any, () => ({
        message: 'x',
      }));
      expect(r.created).toBe(false);
      expect(tx.lead.update).toHaveBeenCalledWith({
        where: { id: 'old' },
        data: { message: 'x' },
      });
      expect(tx.lead.create).not.toHaveBeenCalled();
    });

    it('existing lead, null patch → untouched', async () => {
      tx.lead.findFirst.mockResolvedValue({ id: 'old' });
      const r = await repo.createOrMerge(
        '+998901',
        since,
        {} as any,
        () => null,
      );
      expect(r).toEqual({ lead: { id: 'old' }, created: false });
      expect(tx.lead.update).not.toHaveBeenCalled();
    });
  });
});
