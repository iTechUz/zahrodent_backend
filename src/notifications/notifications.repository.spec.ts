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
});
