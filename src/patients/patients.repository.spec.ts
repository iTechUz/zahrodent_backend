import { PatientsRepository } from './patients.repository';
import { PrismaService } from '../database/prisma.service';

describe('PatientsRepository', () => {
  let prisma: any;
  let repo: PatientsRepository;
  const include = {
    payments: {
      where: { type: 'INCOME' },
      select: { amount: true, status: true, discount: true },
    },
    visits: { where: { status: 'completed' }, select: { price: true } },
    assignedDoctor: { select: { id: true, firstName: true, lastName: true } },
  };

  beforeEach(() => {
    prisma = {
      patient: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      patientComment: { create: jest.fn(), findMany: jest.fn() },
    };
    repo = new PatientsRepository(prisma as PrismaService);
  });

  it('findAll — balans uchun INCOME payments va completed visits include', async () => {
    prisma.patient.count.mockResolvedValue(0);
    await repo.findAll({ source: 'phone' }, { skip: 5, take: 5 });
    expect(prisma.patient.findMany).toHaveBeenCalledWith({
      where: { source: 'phone' },
      include,
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    await repo.findAll();
    expect(prisma.patient.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      include,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findById — xuddi shu include', async () => {
    await repo.findById('p1');
    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include,
    });
  });

  it('count / groupBySource', async () => {
    prisma.patient.count.mockResolvedValue(2);
    await expect(repo.count({ id: 'p1' })).resolves.toBe(2);
    await repo.groupBySource({ source: 'x' });
    expect(prisma.patient.groupBy).toHaveBeenCalledWith({
      by: ['source'],
      where: { source: 'x' },
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
      take: 1,
    });
  });

  it.each(['findSourcesByPatientIds', 'findPhonesByPatientIds'] as const)(
    '%s — bo‘sh ro‘yxatda DB ga bormaydi',
    async (method) => {
      await expect(repo[method]([])).resolves.toEqual([]);
      await expect(repo[method](['', ''])).resolves.toEqual([]);
      expect(prisma.patient.findMany).not.toHaveBeenCalled();
    },
  );

  it('findSourcesByPatientIds — dublikatlar olib tashlanadi', async () => {
    await repo.findSourcesByPatientIds(['p1', 'p2', 'p1', '']);
    expect(prisma.patient.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      select: { id: true, source: true },
    });
  });

  it('findPhonesByPatientIds — dublikatlar olib tashlanadi', async () => {
    await repo.findPhonesByPatientIds(['p1', 'p1']);
    expect(prisma.patient.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1'] } },
      select: { id: true, phone: true },
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.create({ firstName: 'A' } as any);
    expect(prisma.patient.create).toHaveBeenCalledWith({
      data: { firstName: 'A' },
      include,
    });
    await repo.update('p1', { firstName: 'B' });
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { firstName: 'B' },
      include,
    });
  });

  it('softDelete — tranzaksiyada deletedAt + kelgusi faol qabullar bekor', async () => {
    const tx = {
      patient: { update: jest.fn().mockResolvedValue({}) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(tx));
    const at = new Date('2026-07-01T10:00:00Z');
    const from = new Date('2026-07-01T00:00:00Z');
    await expect(
      repo.softDelete('p1', at, from, ['pending', 'confirmed']),
    ).resolves.toEqual({ cancelledBookings: 2 });
    expect(tx.patient.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { deletedAt: at },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        patientId: 'p1',
        date: { gte: from },
        status: { in: ['pending', 'confirmed'] },
      },
      data: { status: 'cancelled' },
    });
  });

  it('restore — deletedAt null', async () => {
    await repo.restore('p1');
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { deletedAt: null },
      include,
    });
  });

  it('findActiveIdsByMobile — faqat raqamlar, 12 yoki 9 xonali, o‘chirilmaganlar', async () => {
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ id: 'p1' }]);
    await expect(repo.findActiveIdsByMobile('+998901234567')).resolves.toEqual([
      { id: 'p1' },
    ]);
    const sql = prisma.$queryRaw.mock.calls[0];
    expect(sql[0].join('?')).toContain('deleted_at IS NULL');
    expect(sql.slice(1)).toEqual(['998901234567', '901234567']);
  });

  it('setTelegramChatId — bo‘sh ro‘yxat DB ga bormaydi', async () => {
    prisma.patient.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await expect(repo.setTelegramChatId([], '1')).resolves.toBe(0);
    expect(prisma.patient.updateMany).not.toHaveBeenCalled();
    await expect(repo.setTelegramChatId(['p1'], '12345')).resolves.toBe(1);
    expect(prisma.patient.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1'] }, deletedAt: null },
      data: { telegramChatId: '12345' },
    });
  });

  it('findAll — orderBy berilsa ishlatiladi', async () => {
    prisma.patient.count.mockResolvedValue(0);
    await repo.findAll({}, { orderBy: [{ age: 'asc' }, { id: 'asc' }] });
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ age: 'asc' }, { id: 'asc' }] }),
    );
  });

  it('findDebtors — raw SQL (INCOME paid|partial + chegirma − completed visits < 0)', async () => {
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ id: 'p1', balance: -5 }]);
    await expect(repo.findDebtors()).resolves.toEqual([
      { id: 'p1', balance: -5 },
    ]);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const text = sql.strings.join('?');
    expect(text).toContain("WHERE type = 'INCOME'");
    expect(text).toContain("status IN ('paid', 'partial')");
    expect(text).toContain("WHERE status = 'completed'");
    expect(text).toContain('< 0');
    expect(text).toContain('p.deleted_at IS NULL');
  });

  it('comments — author include, yangi birinchi', async () => {
    const authorInclude = { author: { select: { name: true, avatar: true } } };
    const data = { content: 'c', patientId: 'p1', authorId: 'u1' };
    await repo.createComment(data);
    expect(prisma.patientComment.create).toHaveBeenCalledWith({
      data,
      include: authorInclude,
    });
    await repo.findCommentsByPatientId('p1');
    expect(prisma.patientComment.findMany).toHaveBeenCalledWith({
      where: { patientId: 'p1' },
      include: authorInclude,
      orderBy: { createdAt: 'desc' },
    });
  });
});
