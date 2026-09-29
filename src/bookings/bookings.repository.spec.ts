import { BookingsRepository } from './bookings.repository';
import { PrismaService } from '../database/prisma.service';

describe('BookingsRepository', () => {
  let prisma: any;
  let repo: BookingsRepository;

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      service: { findUnique: jest.fn() },
    };
    repo = new BookingsRepository(prisma as PrismaService);
  });

  it('findAll — date/time desc, pagination ixtiyoriy', async () => {
    await repo.findAll({ doctorId: 'd1' }, { skip: 0, take: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { doctorId: 'd1' },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      skip: 0,
      take: 10,
    });
    await repo.findAll();
    expect(prisma.booking.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
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
      where: { status: 'pending' },
    });
    await repo.findById('b1');
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: 'b1' },
    });
    await repo.findServiceById('s1');
    expect(prisma.service.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
    await repo.create({ time: '10:00' } as any);
    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: { time: '10:00' },
    });
    await repo.update('b1', { time: '11:00' });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { time: '11:00' },
    });
    await repo.delete('b1');
    expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });
});
