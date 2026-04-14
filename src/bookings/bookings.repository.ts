import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    where?: Prisma.BookingWhereInput,
    opts?: { take?: number },
  ): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      ...(opts?.take != null ? { take: opts.take } : {}),
    });
  }

  markReminderSent(bookingIds: string[], at: Date): Promise<void> {
    if (!bookingIds.length) return Promise.resolve();
    return this.prisma.booking
      .updateMany({
        where: { id: { in: bookingIds } },
        data: { reminderSentAt: at },
      })
      .then(() => undefined);
  }

  findById(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({ where: { id } });
  }

  create(data: Prisma.BookingCreateInput): Promise<Booking> {
    return this.prisma.booking.create({ data });
  }

  update(id: string, data: Prisma.BookingUpdateInput): Promise<Booking> {
    return this.prisma.booking.update({ where: { id }, data });
  }

  delete(id: string): Promise<Booking> {
    return this.prisma.booking.delete({ where: { id } });
  }
}
