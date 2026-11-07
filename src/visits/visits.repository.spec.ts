import { VisitsRepository } from './visits.repository';
import { PrismaService } from '../database/prisma.service';

const PS = {
  patient: { select: { firstName: true, lastName: true, deletedAt: true } },
};

describe('VisitsRepository', () => {
  let prisma: any;
  let repo: VisitsRepository;

  beforeEach(() => {
    prisma = {
      patient: { count: jest.fn() },
      booking: { findUnique: jest.fn() },
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

  it('patientInScope — o‘chirilmagan va scope bo‘yicha count', async () => {
    prisma.patient.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const scope = { assignedDoctorId: 'd1' };
    await expect(repo.patientInScope('p1', scope)).resolves.toBe(true);
    await expect(repo.patientInScope('p1', scope)).resolves.toBe(false);
    expect(prisma.patient.count).toHaveBeenCalledWith({
      where: { AND: [{ id: 'p1', deletedAt: null }, scope] },
    });
  });

  it('findBookingOwner — id, patientId, doctorId', async () => {
    await repo.findBookingOwner('b1');
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: 'b1' },
      select: { id: true, patientId: true, doctorId: true },
    });
  });

  it('findAll — date desc, data+total', async () => {
    await expect(
      repo.findAll({ doctorId: 'd1' }, { skip: 0, take: 10 }),
    ).resolves.toEqual({ data: [{ id: 'v1' }], total: 1 });
    expect(prisma.visit.findMany).toHaveBeenCalledWith({
      where: { doctorId: 'd1' },
      include: PS,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    await repo.findAll();
    expect(prisma.visit.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      include: PS,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  });

  it('CRUD delegatsiyasi', async () => {
    await repo.findById('v1');
    expect(prisma.visit.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      include: PS,
    });
    await repo.create({ status: 'completed' } as any);
    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: { status: 'completed' },
      include: PS,
    });
    await repo.update('v1', { price: 1 });
    expect(prisma.visit.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { price: 1 },
      include: PS,
    });
  });
});
