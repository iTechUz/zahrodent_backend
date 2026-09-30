import { NotificationsRepository } from './notifications.repository';
import { PrismaService } from '../database/prisma.service';

describe('NotificationsRepository', () => {
  let prisma: any;
  let repo: NotificationsRepository;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new NotificationsRepository(prisma as PrismaService);
  });

  it('findAll — sentAt desc, pagination ixtiyoriy', async () => {
    await expect(repo.findAll({ skip: 5, take: 5 })).resolves.toEqual({
      data: [],
      total: 0,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      orderBy: { sentAt: 'desc' },
      skip: 5,
      take: 5,
    });
    await repo.findAll();
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith({
      orderBy: { sentAt: 'desc' },
    });
  });

  it('create / createMany', async () => {
    await repo.create({ type: 'sms' } as any);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { type: 'sms' },
    });
    await repo.createMany([{ type: 'sms' } as any]);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [{ type: 'sms' }],
    });
  });

  it('findReminderCandidates — faol, eslatilmagan, oraliqda, o‘chirilmagan bemor', async () => {
    const from = new Date('2026-07-01T00:00:00Z');
    const to = new Date('2026-07-02T00:00:00Z');
    await repo.findReminderCandidates(from, to, ['pending', 'confirmed']);
    const arg = prisma.booking.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      status: { in: ['pending', 'confirmed'] },
      reminderSentAt: null,
      date: { gte: from, lte: to },
      patient: { deletedAt: null },
    });
    expect(arg.select.patient.select).toEqual({
      firstName: true,
      lastName: true,
      phone: true,
      telegramChatId: true,
    });
    expect(arg.select.doctor).toEqual({
      select: { firstName: true, lastName: true },
    });
  });
});
