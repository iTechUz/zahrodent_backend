import { PatientsRepository } from './patients.repository';
import { PrismaService } from '../database/prisma.service';

describe('PatientsRepository', () => {
  let prisma: any;
  let repo: PatientsRepository;
  const include = {
    payments: { where: { status: 'paid' }, select: { amount: true } },
    visits: { where: { status: 'completed' }, select: { price: true } },
    assignedDoctor: { select: { firstName: true, lastName: true } },
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

  it('findAll — balans uchun paid payments va completed visits include', async () => {
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
    await repo.groupBySource();
    expect(prisma.patient.groupBy).toHaveBeenCalledWith({
      by: ['source'],
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
    });
    await repo.update('p1', { firstName: 'B' });
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { firstName: 'B' },
    });
    await repo.delete('p1');
    expect(prisma.patient.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
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
