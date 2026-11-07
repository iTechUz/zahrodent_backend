import { BookingsRepository } from './bookings.repository';
import { PrismaService } from '../database/prisma.service';

const PS = {
  patient: { select: { firstName: true, lastName: true, deletedAt: true } },
};

describe('BookingsRepository', () => {
  let prisma: any;
  let repo: BookingsRepository;

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      service: { findUnique: jest.fn() },
    };
    repo = new BookingsRepository(prisma as PrismaService);
  });

  const HAS_PATIENT = { patient: { is: { id: { not: '' } } } };

  it('findAll — date/time desc, pagination ixtiyoriy', async () => {
    await repo.findAll({ doctorId: 'd1' }, { skip: 0, take: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { AND: [{ doctorId: 'd1' }, HAS_PATIENT] },
      include: PS,
      orderBy: [{ date: 'desc' }, { time: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    await repo.findAll();
    expect(prisma.booking.findMany).toHaveBeenLastCalledWith({
      where: { AND: [{}, HAS_PATIENT] },
      include: PS,
      orderBy: [{ date: 'desc' }, { time: 'desc' }, { id: 'desc' }],
    });
    expect(prisma.booking.count).toHaveBeenLastCalledWith({
      where: { AND: [{}, HAS_PATIENT] },
    });
  });

  it('markReminderSent — bo‘sh ro‘yxatda DB ga bormaydi', async () => {
    await expect(
      repo.markReminderSent([], new Date()),
    ).resolves.toBeUndefined();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('markReminderSent — updateMany va void qaytaradi', async () => {
    const at = new Date('2026-06-01T00:00:00Z');
    await expect(repo.markReminderSent(['b1'], at)).resolves.toBeUndefined();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] } },
      data: { reminderSentAt: at },
    });
  });

  it('findManyWithService — service include', async () => {
    await repo.findManyWithService({ doctorId: 'd1' });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { doctorId: 'd1' },
      include: { service: true },
    });
  });

  it('CRUD/count/findServiceById delegatsiyasi', async () => {
    await repo.count({ status: 'pending' });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { AND: [{ status: 'pending' }, HAS_PATIENT] },
    });
    await repo.findById('b1');
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', ...HAS_PATIENT },
      include: PS,
    });
    await repo.findServiceById('s1');
    expect(prisma.service.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
    await repo.create({ time: '10:00' } as any);
    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: { time: '10:00' },
      include: PS,
    });
    await repo.update('b1', { time: '11:00' });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { time: '11:00' },
      include: PS,
    });
    await repo.delete('b1');
    expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });

  it('findAll — orderBy berilsa standart o‘rniga ishlatiladi', async () => {
    await repo.findAll({}, { orderBy: [{ time: 'asc' }, { id: 'asc' }] });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ time: 'asc' }, { id: 'asc' }] }),
    );
  });

  it('withDoctorDayLock — tranzaksiya ichida advisory lock, keyin fn(tx)', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));
    const fn = jest.fn(async (t: any) => {
      await repo.findManyWithService({ doctorId: 'd1' }, t);
      return 'done';
    });
    await expect(repo.withDoctorDayLock('d1', '2026-06-10', fn)).resolves.toBe(
      'done',
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, key] = tx.$executeRaw.mock.calls[0];
    expect(strings.join('?')).toContain('pg_advisory_xact_lock(hashtext(?))');
    expect(key).toBe('booking:d1:2026-06-10');
    // queries inside the lock use the transaction client
    expect(tx.booking.findMany).toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('findDoctorAvailability — schedule va daysOff', async () => {
    prisma.doctor = { findUnique: jest.fn().mockResolvedValue(null) };
    await repo.findDoctorAvailability('d1');
    expect(prisma.doctor.findUnique).toHaveBeenCalledWith({
      where: { id: 'd1' },
      select: { id: true, schedule: true, daysOff: true },
    });
  });

  it('withLocks — kalitlar saralangan tartibda olinadi (deadlock yo‘q)', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));
    await repo.withLocks(['b', 'a', 'b'], async () => 'ok');
    expect(tx.$executeRaw.mock.calls.map((c: any[]) => c[1])).toEqual([
      'a',
      'b',
    ]);
  });

  describe('ensureVisitForCompleted', () => {
    const b = {
      id: 'b1',
      patientId: 'p1',
      doctorId: 'd1',
      date: new Date('2026-06-10T00:00:00.000Z'),
      serviceId: 's1' as string | null,
    };
    let tx: any;
    beforeEach(() => {
      tx = {
        visit: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        service: {
          findUnique: jest.fn().mockResolvedValue({ price: 150000 }),
        },
      };
    });

    it('creates a completed visit priced from the service', async () => {
      await expect(repo.ensureVisitForCompleted(b, tx)).resolves.toEqual({
        created: true,
      });
      expect(tx.visit.create).toHaveBeenCalledWith({
        data: {
          patientId: 'p1',
          doctorId: 'd1',
          bookingId: 'b1',
          date: b.date,
          status: 'completed',
          price: 150000,
        },
      });
      expect(tx.visit.findFirst.mock.calls[0][0].where.OR).toEqual([
        { bookingId: 'b1' },
        { patientId: 'p1', doctorId: 'd1', date: b.date },
      ]);
    });

    it('no service → price 0', async () => {
      await repo.ensureVisitForCompleted({ ...b, serviceId: null }, tx);
      expect(tx.visit.create.mock.calls[0][0].data.price).toBe(0);
      expect(tx.service.findUnique).not.toHaveBeenCalled();
    });

    it('existing visit (linked or same patient+doctor+day) → skipped', async () => {
      tx.visit.findFirst.mockResolvedValue({ id: 'v1' });
      await expect(repo.ensureVisitForCompleted(b, tx)).resolves.toEqual({
        created: false,
      });
      expect(tx.visit.create).not.toHaveBeenCalled();
    });
  });

  it('findPatientIdsByPhoneDigits — id lar ro‘yxati', async () => {
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    await expect(repo.findPatientIdsByPhoneDigits('90123')).resolves.toEqual([
      'p1',
      'p2',
    ]);
    expect(prisma.$queryRaw.mock.calls[0][1]).toBe('%90123%');
  });
});
