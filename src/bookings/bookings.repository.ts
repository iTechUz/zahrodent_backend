import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.BookingWhereInput,
    opts?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.BookingOrderByWithRelationInput[];
    },
  ): Promise<{ data: Booking[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: opts?.orderBy ?? [{ date: 'desc' }, { time: 'desc' }],
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.BookingWhereInput): Promise<number> {
    return this.prisma.booking.count({ where });
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

  findServiceById(id: string) {
    return this.prisma.service.findUnique({ where: { id } });
  }

  findDoctorAvailability(doctorId: string) {
    return this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, schedule: true, daysOff: true },
    });
  }

  findManyWithService(where: Prisma.BookingWhereInput, db: Db = this.prisma) {
    return db.booking.findMany({
      where,
      include: { service: true },
    });
  }

  /**
   * Runs `fn` in a transaction holding a Postgres advisory lock for
   * (doctorId, date), so two concurrent requests can't both pass the
   * overlap check and double-book the same slot.
   */
  withDoctorDayLock<T>(
    doctorId: string,
    dateOnly: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const key = `booking:${doctorId}:${dateOnly}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      return fn(tx);
    });
  }

  create(
    data: Prisma.BookingCreateInput,
    db: Db = this.prisma,
  ): Promise<Booking> {
    return db.booking.create({ data });
  }

  update(
    id: string,
    data: Prisma.BookingUpdateInput,
    db: Db = this.prisma,
  ): Promise<Booking> {
    return db.booking.update({ where: { id }, data });
  }

  delete(id: string): Promise<Booking> {
    return this.prisma.booking.delete({ where: { id } });
  }
}
