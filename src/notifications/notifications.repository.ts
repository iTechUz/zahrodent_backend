import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(opts?: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { sentAt: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.notification.count(),
    ]);
    return { data, total };
  }

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  createMany(data: Prisma.NotificationCreateManyInput[]) {
    return this.prisma.notification.createMany({ data });
  }
}
