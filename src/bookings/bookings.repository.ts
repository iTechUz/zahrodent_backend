import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PatientSummaryRow,
  WITH_PATIENT_SUMMARY,
} from '../patients/patient-summary';

type Db = PrismaService | Prisma.TransactionClient;

export type BookingWithPatient = Booking & {
  patient?: PatientSummaryRow | null;
};

/**
 * Skips orphan rows (patient_id without a patients row): one of them would
 * otherwise fail the whole list with Prisma's "Inconsistent query result".
 */
const HAS_PATIENT_ROW: Prisma.BookingWhereInput = {
  patient: { is: { id: { not: '' } } },
};

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
  ): Promise<{ data: BookingWithPatient[]; total: number }> {
    const listWhere: Prisma.BookingWhereInput = {
      AND: [where ?? {}, HAS_PATIENT_ROW],
    };
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: listWhere,
        include: WITH_PATIENT_SUMMARY,
        orderBy: opts?.orderBy ?? [{ date: 'desc' }, { time: 'desc' }],
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.booking.count({ where: listWhere }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.BookingWhereInput): Promise<number> {
    return this.prisma.booking.count({
      where: { AND: [where ?? {}, HAS_PATIENT_ROW] },
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

  findById(id: string): Promise<BookingWithPatient | null> {
    return this.prisma.booking.findFirst({
      where: { id, ...HAS_PATIENT_ROW },
      include: WITH_PATIENT_SUMMARY,
    });
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
  ): Promise<BookingWithPatient> {
    return db.booking.create({ data, include: WITH_PATIENT_SUMMARY });
  }

  update(
    id: string,
    data: Prisma.BookingUpdateInput,
    db: Db = this.prisma,
  ): Promise<BookingWithPatient> {
    return db.booking.update({
      where: { id },
      data,
      include: WITH_PATIENT_SUMMARY,
    });
  }

  delete(id: string): Promise<Booking> {
    return this.prisma.booking.delete({ where: { id } });
  }
}
