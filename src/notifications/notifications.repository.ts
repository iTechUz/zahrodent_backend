import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(opts?: {
    skip?: number;
    take?: number;
    where?: Prisma.NotificationWhereInput;
  }): Promise<{ data: Notification[]; total: number }> {
    const where = opts?.where;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        ...(where ? { where } : {}),
        orderBy: { sentAt: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.notification.count(where ? { where } : undefined),
    ]);
    return { data, total };
  }

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  /**
   * Bookings due a reminder: active, not reminded yet, date within
   * [from, to] and the patient not soft-deleted.
   */
  findReminderCandidates(from: Date, to: Date, statuses: string[]) {
    return this.prisma.booking.findMany({
      where: {
        status: { in: statuses },
        reminderSentAt: null,
        date: { gte: from, lte: to },
        patient: { deletedAt: null },
      },
      select: {
        id: true,
        patientId: true,
        date: true,
        time: true,
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            telegramChatId: true,
          },
        },
        doctor: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  }

  createMany(data: Prisma.NotificationCreateManyInput[]) {
    return this.prisma.notification.createMany({ data });
  }
}
