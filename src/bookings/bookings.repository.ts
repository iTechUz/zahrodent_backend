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

export const doctorDayLockKey = (doctorId: string, dateOnly: string) =>
  `booking:${doctorId}:${dateOnly}`;

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
        orderBy: opts?.orderBy ?? [
          { date: 'desc' },
          { time: 'desc' },
          { id: 'desc' },
        ],
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

  findById(
    id: string,
    db: Db = this.prisma,
  ): Promise<BookingWithPatient | null> {
    return db.booking.findFirst({
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
    return this.withLocks([doctorDayLockKey(doctorId, dateOnly)], fn);
  }

  /**
   * Same, for several keys (e.g. the booking row + its doctor/day). Keys are
   * taken in sorted order so two requests can't deadlock each other.
   */
  withLocks<T>(
    keys: string[],
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const sorted = [...new Set(keys)].sort();
    return this.prisma.$transaction(async (tx) => {
      for (const key of sorted) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      }
      return fn(tx);
    });
  }

  /**
   * Visit for a booking that just became "completed": status completed,
   * price = service price. Skipped when a visit is already linked to the
   * booking or the same patient+doctor+day already has one.
   */
  async ensureVisitForCompleted(
    b: {
      id: string;
      patientId: string;
      doctorId: string;
      date: Date;
      serviceId: string | null;
    },
    db: Db = this.prisma,
  ): Promise<{ created: boolean }> {
    const existing = await db.visit.findFirst({
      where: {
        OR: [
          { bookingId: b.id },
          { patientId: b.patientId, doctorId: b.doctorId, date: b.date },
        ],
      },
      select: { id: true },
    });
    if (existing) return { created: false };
    const service = b.serviceId
      ? await db.service.findUnique({
          where: { id: b.serviceId },
          select: { price: true },
        })
      : null;
    await db.visit.create({
      data: {
        patientId: b.patientId,
        doctorId: b.doctorId,
        bookingId: b.id,
        date: b.date,
        status: 'completed',
        price: service?.price ?? 0,
      },
    });
    return { created: true };
  }

  /**
   * Patient ids whose phone contains these digits regardless of formatting
   * ("+998 (90) 123-45-67"). Capped; callers require >= 3 digits.
   */
  async findPatientIdsByPhoneDigits(digits: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM patients
      WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + digits + '%'}
      LIMIT 1000`;
    return rows.map((r) => r.id);
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
