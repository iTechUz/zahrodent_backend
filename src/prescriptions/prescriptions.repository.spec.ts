import {
  PRESCRIPTION_INCLUDE,
  PrescriptionsRepository,
} from './prescriptions.repository';
import { PrismaService } from '../database/prisma.service';

describe('PrescriptionsRepository', () => {
  let prisma: any;
  let repo: PrescriptionsRepository;

  beforeEach(() => {
    prisma = {
      prescription: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      patient: { count: jest.fn() },
      visit: { count: jest.fn() },
    };
    repo = new PrescriptionsRepository(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('findMany va count bir xil where bilan; { data, total }', async () => {
      const where = { patientId: 'p1' };
      prisma.prescription.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.prescription.count.mockResolvedValue(7);

      await expect(
        repo.findAll(where, { skip: 10, take: 5, orderBy: [{ code: 'asc' }] }),
      ).resolves.toEqual({ data: [{ id: 'r1' }], total: 7 });

      expect(prisma.prescription.findMany).toHaveBeenCalledWith({
        where,
        include: PRESCRIPTION_INCLUDE,
        orderBy: [{ code: 'asc' }],
        skip: 10,
        take: 5,
      });
      expect(prisma.prescription.count).toHaveBeenCalledWith({ where });
    });

    it('orderBy berilmasa — createdAt desc', async () => {
      await repo.findAll({}, {});
      expect(prisma.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('findMany xatosi tarqaladi', async () => {
      prisma.prescription.findMany.mockRejectedValue(new Error('db'));
      await expect(repo.findAll({}, {})).rejects.toThrow('db');
    });
  });

  it('findById — include bilan findUnique', async () => {
    prisma.prescription.findUnique.mockResolvedValue({ id: 'r1' });
    await expect(repo.findById('r1')).resolves.toEqual({ id: 'r1' });
    expect(prisma.prescription.findUnique).toHaveBeenCalledWith({
      where: { id: 'r1' },
      include: PRESCRIPTION_INCLUDE,
    });
  });

  it('findById — topilmasa null', async () => {
    prisma.prescription.findUnique.mockResolvedValue(null);
    await expect(repo.findById('x')).resolves.toBeNull();
  });

  it('create — include bilan', async () => {
    const data = { code: 'ABCD2345' } as any;
    prisma.prescription.create.mockResolvedValue({ id: 'r1' });
    await expect(repo.create(data)).resolves.toEqual({ id: 'r1' });
    expect(prisma.prescription.create).toHaveBeenCalledWith({
      data,
      include: PRESCRIPTION_INCLUDE,
    });
  });

  describe('transition', () => {
    it('updateMany id + joriy status bo‘yicha; o‘zgargan qatorlar soni', async () => {
      const data = { status: 'dispensed' };
      await expect(repo.transition('r1', 'issued', data)).resolves.toBe(1);
      expect(prisma.prescription.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'issued' },
        data,
      });
    });

    it('notExpiredOn berilsa — validUntil >= sana sharti qo‘shiladi', async () => {
      const now = new Date('2026-09-01T10:00:00.000Z');
      await repo.transition('r1', 'issued', { status: 'dispensed' }, now);
      expect(prisma.prescription.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'issued', validUntil: { gte: now } },
        data: { status: 'dispensed' },
      });
    });

    it('status allaqachon o‘zgargan (poyga) — 0 qaytadi', async () => {
      prisma.prescription.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        repo.transition('r1', 'issued', { status: 'cancelled' }),
      ).resolves.toBe(0);
    });

    it('updateMany xatosi tarqaladi', async () => {
      prisma.prescription.updateMany.mockRejectedValue(new Error('db'));
      await expect(
        repo.transition('r1', 'issued', { status: 'cancelled' }),
      ).rejects.toThrow('db');
    });
  });

  it('countPatients / countVisits — where uzatiladi', async () => {
    prisma.patient.count.mockResolvedValue(3);
    prisma.visit.count.mockResolvedValue(2);
    await expect(repo.countPatients({ id: 'p1' })).resolves.toBe(3);
    await expect(repo.countVisits({ id: 'v1' })).resolves.toBe(2);
    expect(prisma.patient.count).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(prisma.visit.count).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });
});
