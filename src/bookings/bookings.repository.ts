import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.BookingWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Booking[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total };
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
