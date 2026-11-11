import { PaymentsRepository } from './payments.repository';
import { PrismaService } from '../database/prisma.service';

const PS = {
  patient: { select: { firstName: true, lastName: true, deletedAt: true } },
};

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
      paymentAudit: { create: jest.fn(), findMany: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    repo = new PaymentsRepository(prisma as PrismaService);
  });

  it('findAll — date desc, pagination', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);
    await repo.findAll({ status: 'paid' }, { skip: 10, take: 10 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { status: 'paid' },
      include: PS,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: { status: 'paid' },
    });
    await repo.findAll();
    expect(prisma.payment.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      include: PS,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  });

  it('getDoctorStats — davr berilsa payments.date bo‘yicha filtrlanadi', async () => {
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.visit.findMany.mockResolvedValue([]);
    const range = {
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lte: new Date('2026-10-31T00:00:00.000Z'),
    };
    await repo.getDoctorStats(range);
    expect(prisma.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'INCOME',
          status: { in: ['paid', 'partial'] },
          visitId: { not: null },
          date: range,
        },
      }),
    );
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
      include: PS,
    });
  });

  describe('audit trail (bitta tranzaksiyada)', () => {
    const actor = { id: 'u1', name: 'Admin' };
    const row = {
      id: 'pay1',
      amount: 5,
      date: new Date('2026-06-01T00:00:00.000Z'),
    };

    it('createWithAudit — createdById va create audit', async () => {
      prisma.payment.create.mockResolvedValue(row);
      await repo.createWithAudit({ amount: 5 } as any, actor);
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: { amount: 5, createdById: 'u1' },
        include: PS,
      });
      expect(prisma.paymentAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'pay1',
          action: 'create',
          actorId: 'u1',
          actorName: 'Admin',
          before: undefined,
          after: { ...row, date: '2026-06-01T00:00:00.000Z' },
        }),
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('updateWithAudit — avval/keyin snapshot', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...row, amount: 1 });
      prisma.payment.update.mockResolvedValue(row);
      await repo.updateWithAudit('pay1', { amount: 5 }, actor);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { amount: 5 },
        include: PS,
      });
      const data = prisma.paymentAudit.create.mock.calls[0][0].data;
      expect(data.action).toBe('update');
      expect(data.before.amount).toBe(1);
      expect(data.after.amount).toBe(5);
    });

    it('deleteWithAudit — to‘liq qator audit ga yoziladi, keyin o‘chiriladi', async () => {
      prisma.payment.findUnique.mockResolvedValue(row);
      const order: string[] = [];
      prisma.paymentAudit.create.mockImplementation(async () => {
        order.push('audit');
      });
      prisma.payment.delete.mockImplementation(async () => {
        order.push('delete');
        return row;
      });
      await repo.deleteWithAudit('pay1', actor);
      expect(order).toEqual(['audit', 'delete']);
      const data = prisma.paymentAudit.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ action: 'delete', after: undefined });
      expect(data.before.id).toBe('pay1');
      expect(prisma.payment.delete).toHaveBeenCalledWith({
        where: { id: 'pay1' },
      });
    });

    it('audit yozilmasa to‘lov ham saqlanmaydi (xato tranzaksiyani buzadi)', async () => {
      prisma.payment.create.mockResolvedValue(row);
      prisma.paymentAudit.create.mockRejectedValue(new Error('boom'));
      await expect(
        repo.createWithAudit({ amount: 5 } as any, actor),
      ).rejects.toThrow('boom');
    });

    it('listAudit — yangisi birinchi', async () => {
      prisma.paymentAudit.findMany.mockResolvedValue([]);
      await repo.listAudit('pay1');
      expect(prisma.paymentAudit.findMany).toHaveBeenCalledWith({
        where: { paymentId: 'pay1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      });
    });
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
      select: { id: true, patientId: true, price: true },
    });
  });
});
