import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BookingsRepository,
  BookingWithPatient,
  doctorDayLockKey,
} from './bookings.repository';
import {
  connectActivePatient,
  toPatientSummary,
} from '../patients/patient-summary';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import {
  dateOnlyColumnRange,
  isPastInTashkent,
  parseDateOnlyToUTC,
  relativeDateRange,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';
import { doctorScopeId } from '../common/auth/doctor-scope';
import { BookingStatusService } from './booking-status.service';
import {
  assertServiceForCompletion,
  assertStatusTransition,
} from './booking-transitions';
import {
  DEFAULT_DURATION_MIN,
  minutesToTime,
  scheduleViolation,
  timeToMinutes,
} from './schedule-conflict';
import { formatReminderDate } from '../settings/reminder-template';

/** Statuses that occupy the doctor's time slot. */
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
/**
 * Statuses that block the doctor's slot for conflict checks: the active ones
 * plus 'arrived' (patient in the chair). Reminders keep using
 * ACTIVE_BOOKING_STATUSES so arrived patients are not reminded.
 */
export const SLOT_OCCUPYING_STATUSES = [...ACTIVE_BOOKING_STATUSES, 'arrived'];

export const BOOKING_NOT_FOUND = 'Qabul topilmadi';

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly statusService?: BookingStatusService,
  ) {}

  async findAll(
    query: BookingsQueryDto,
    user: AuthUserView,
  ): Promise<PaginatedResponse<ReturnType<BookingsService['toResponse']>>> {
    const {
      search,
      status,
      source,
      patientId,
      doctorId,
      dateRange = 'all',
      startDate,
      endDate,
    } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.BookingWhereInput = {};

    const scopedDoctorId = doctorScopeId(user);
    if (scopedDoctorId) {
      where.doctorId = scopedDoctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status;
    if (source && source !== 'all') where.source = source;

    if (search?.trim()) {
      where.patient = await this.patientSearchWhere(search);
    }

    if (startDate || endDate) {
      where.date = dateOnlyColumnRange(startDate, endDate);
    } else if (dateRange !== 'all') {
      const { start, end } = relativeDateRange(dateRange);
      where.date = dateOnlyColumnRange(start, end);
    }

    const { data, total } = await this.bookingsRepository.findAll(where, {
      skip,
      take: limitNum,
      ...this.orderBy(query),
    });
    return { data: data.map((b) => this.toResponse(b)), total };
  }

  /**
   * "Ali Valiyev" → every word must hit first or last name; phone-like words
   * ("+998 90 123") are joined and matched against the digits of the phone.
   */
  private async patientSearchWhere(
    search: string,
  ): Promise<Prisma.PatientWhereInput> {
    const tokens = search.trim().split(/\s+/).filter(Boolean);
    const isPhoneLike = (t: string) => /^[+\d()\-.]+$/.test(t) && /\d/.test(t);
    const and: Prisma.PatientWhereInput[] = tokens
      .filter((t) => !isPhoneLike(t))
      .map((t) => ({
        OR: [
          { firstName: { contains: t, mode: 'insensitive' } },
          { lastName: { contains: t, mode: 'insensitive' } },
        ],
      }));
    const digits = tokens.filter(isPhoneLike).join('').replace(/\D/g, '');
    if (digits) {
      // Fewer than 3 digits would match nearly every phone: treat as no match.
      const ids =
        digits.length >= 3
          ? await this.bookingsRepository.findPatientIdsByPhoneDigits(digits)
          : [];
      and.push({ id: { in: ids } });
    }
    return { AND: and };
  }

  /** Date sort is date → time → id (stable paging); others get an id tie-break. */
  private orderBy(query: BookingsQueryDto) {
    const field = query.sortBy ?? (query.order ? 'date' : undefined);
    if (field === 'date') {
      const o = query.order ?? 'asc';
      return {
        orderBy: [
          { date: o },
          { time: o },
          { id: o },
        ] as Prisma.BookingOrderByWithRelationInput[],
      };
    }
    return orderByOption<Prisma.BookingOrderByWithRelationInput[]>(
      query,
      'date',
    );
  }

  async findOne(id: string, user: AuthUserView) {
    const b = await this.getAccessible(id, user);
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto, user?: AuthUserView) {
    const today = todayInTashkent();
    if (dto.date < today) {
      throw new BadRequestException("O'tgan sanaga qabul yaratib bo'lmaydi");
    }
    if (
      ACTIVE_BOOKING_STATUSES.includes(dto.status) &&
      isPastInTashkent(dto.date, dto.time)
    ) {
      throw new BadRequestException(
        "Bugungi o'tib ketgan vaqtga qabul yaratib bo'lmaydi",
      );
    }
    assertStatusTransition({
      from: 'pending',
      to: dto.status,
      role: user?.role ?? '',
      bookingDate: dto.date,
      today,
    });
    assertServiceForCompletion(dto.status, dto.serviceId);
    const duration = await this.getDuration(dto.serviceId);
    await this.checkDoctorSchedule(dto.doctorId, dto.date, dto.time, duration);

    const b = await this.bookingsRepository.withDoctorDayLock(
      dto.doctorId,
      dto.date,
      async (tx) => {
        if (SLOT_OCCUPYING_STATUSES.includes(dto.status)) {
          await this.checkConflicts(tx, {
            doctorId: dto.doctorId,
            date: dto.date,
            time: dto.time,
            duration,
          });
        }
        const created = await this.bookingsRepository.create(
          {
            patient: connectActivePatient(dto.patientId),
            doctor: { connect: { id: dto.doctorId } },
            date: parseDateOnlyToUTC(dto.date),
            time: dto.time,
            source: dto.source,
            status: dto.status,
            notes: dto.notes ?? '',
            service: dto.serviceId
              ? { connect: { id: dto.serviceId } }
              : undefined,
            // DATE column: clinic calendar day, not the DB server's TZ.
            createdAt: parseDateOnlyToUTC(today),
          },
          tx,
        );
        if (created.status === 'completed') {
          await this.bookingsRepository.ensureVisitForCompleted(created, tx);
        }
        return created;
      },
    );
    if (this.statusService) {
      void this.statusService.onCreated(
        b.id,
        user ? { id: user.id, name: user.name } : undefined,
      );
    }
    return this.toResponse(b);
  }

  async update(id: string, dto: UpdateBookingDto, user: AuthUserView) {
    const first = await this.getAccessible(id, user);

    // The lock key is derived from the pre-read; the row is re-read under the
    // lock and the key re-checked, so the from-status/slot we act on is fresh.
    const lockKey = (doctorId: string, date: string) =>
      doctorDayLockKey(doctorId, date);
    const firstKey = lockKey(
      dto.doctorId ?? first.doctorId,
      dto.date ?? toDateOnlyString(first.date),
    );

    const { b, current, change } = await this.bookingsRepository.withLocks(
      [`booking-row:${id}`, firstKey],
      async (tx) => {
        const current = await this.bookingsRepository.findById(id, tx);
        const scopedDoctorId = doctorScopeId(user);
        if (
          !current ||
          (scopedDoctorId && current.doctorId !== scopedDoctorId)
        ) {
          throw new NotFoundException(BOOKING_NOT_FOUND);
        }
        const currentDate = toDateOnlyString(current.date);
        const next = {
          doctorId: dto.doctorId ?? current.doctorId,
          date: dto.date ?? currentDate,
          time: dto.time ?? current.time,
          serviceId:
            dto.serviceId === undefined
              ? current.serviceId
              : dto.serviceId || null,
          status: dto.status ?? current.status,
        };
        if (lockKey(next.doctorId, next.date) !== firstKey) {
          throw new ConflictException(
            "Qabul boshqa foydalanuvchi tomonidan o'zgartirildi — sahifani yangilab qayta urinib ko'ring",
          );
        }

        const statusChanged = next.status !== current.status;
        if (statusChanged) {
          assertStatusTransition({
            from: current.status,
            to: next.status,
            role: user.role,
            bookingDate: next.date,
            today: todayInTashkent(),
          });
          assertServiceForCompletion(next.status, next.serviceId);
          if (next.status === 'cancelled' && !dto.statusReason?.trim()) {
            throw new BadRequestException(
              'Bekor qilish sababini kiriting (statusReason)',
            );
          }
        }

        const dateTimeChanged =
          next.date !== currentDate || next.time !== current.time;
        const slotChanged =
          dateTimeChanged ||
          next.doctorId !== current.doctorId ||
          next.serviceId !== current.serviceId;
        if (
          dateTimeChanged &&
          ACTIVE_BOOKING_STATUSES.includes(next.status) &&
          isPastInTashkent(next.date, next.time)
        ) {
          throw new BadRequestException(
            "O'tib ketgan sana yoki vaqtga qabulni ko'chirib bo'lmaydi",
          );
        }
        // e.g. cancelled → pending: the slot may have been taken meanwhile.
        const reactivated =
          !SLOT_OCCUPYING_STATUSES.includes(current.status) &&
          SLOT_OCCUPYING_STATUSES.includes(next.status);

        const data: Prisma.BookingUpdateInput = {
          date:
            dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
          time: dto.time,
          source: dto.source,
          status: dto.status,
          notes: dto.notes,
          patient:
            dto.patientId === undefined
              ? undefined
              : connectActivePatient(dto.patientId),
          doctor:
            dto.doctorId === undefined
              ? undefined
              : { connect: { id: dto.doctorId } },
          service:
            dto.serviceId === undefined
              ? undefined
              : dto.serviceId
                ? { connect: { id: dto.serviceId } }
                : { disconnect: true },
        };

        // Moved to another day/time/doctor: reminders and confirmations are stale.
        if (dateTimeChanged || next.doctorId !== current.doctorId) {
          data.reminder24SentAt = null;
          data.reminder2SentAt = null;
          data.patientConfirmedAt = null;
          data.rescheduleRequestedAt = null;
        }

        if (SLOT_OCCUPYING_STATUSES.includes(next.status)) {
          const duration = await this.getDuration(next.serviceId);
          if (slotChanged || reactivated) {
            await this.checkDoctorSchedule(
              next.doctorId,
              next.date,
              next.time,
              duration,
            );
            await this.checkConflicts(tx, {
              doctorId: next.doctorId,
              date: next.date,
              time: next.time,
              duration,
              excludeId: id,
            });
          }
        }

        const updated = await this.bookingsRepository.update(id, data, tx);
        if (statusChanged && next.status === 'completed') {
          await this.bookingsRepository.ensureVisitForCompleted(updated, tx);
        }
        return {
          b: updated,
          current,
          change: {
            statusChanged,
            to: next.status,
            moved: dateTimeChanged || next.doctorId !== current.doctorId,
          },
        };
      },
    );
    this.afterUpdate(current, b, change, dto, user);
    return this.toResponse(b);
  }

  /**
   * Audit log + Telegram notices (fire-and-forget): status change and/or a
   * move to another day/time/doctor.
   */
  private afterUpdate(
    current: BookingWithPatient,
    b: BookingWithPatient,
    change: { statusChanged: boolean; to: string; moved: boolean },
    dto: UpdateBookingDto,
    user: AuthUserView,
  ) {
    if (!this.statusService) return;
    const actor = { id: user.id, name: user.name };
    if (change.statusChanged) {
      void this.statusService.onChanged({
        bookingId: b.id,
        from: current.status,
        to: change.to,
        reason: dto.statusReason,
        actor,
      });
    }
    if (change.moved && ACTIVE_BOOKING_STATUSES.includes(change.to)) {
      void this.statusService.onRescheduled({
        bookingId: b.id,
        previousWhen: `${formatReminderDate(toDateOnlyString(current.date))} ${current.time}`,
        actor,
        // confirmed/cancelled/completed messages already carry the new time.
        notifyPatient: !(
          change.statusChanged &&
          ['confirmed', 'cancelled', 'completed'].includes(change.to)
        ),
      });
    }
  }

  async getStatusLog(id: string, user: AuthUserView) {
    await this.getAccessible(id, user);
    return this.statusService ? this.statusService.history(id) : [];
  }

  /**
   * Deleting cascades the status logs away, so the "who deleted what" trail
   * is the application log + a staff-group notice, and the patient is told
   * when an active booking disappears.
   */
  async remove(id: string, user: AuthUserView) {
    await this.getAccessible(id, user);
    const snap = this.statusService
      ? await this.statusService.snapshot(id).catch(() => null)
      : null;
    await this.bookingsRepository.delete(id);
    if (this.statusService) {
      void this.statusService.onDeleted(snap, {
        id: user.id,
        name: user.name,
      });
    }
    return { id };
  }

  private async getAccessible(id: string, user: AuthUserView) {
    const scopedDoctorId = doctorScopeId(user);
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException(BOOKING_NOT_FOUND);
    if (scopedDoctorId && b.doctorId !== scopedDoctorId) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
    return b;
  }

  async getStats(user: AuthUserView) {
    const today = parseDateOnlyToUTC(todayInTashkent());

    const baseWhere: Prisma.BookingWhereInput = {};
    const scopedDoctorId = doctorScopeId(user);
    if (scopedDoctorId) baseWhere.doctorId = scopedDoctorId;

    const [todayCount, pendingCount, completedToday] = await Promise.all([
      this.bookingsRepository.count({
        ...baseWhere,
        date: today,
        status: { notIn: ['cancelled', 'no-show'] },
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'pending',
        date: { gte: today },
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'completed',
        date: today,
      }),
    ]);

    return {
      today: todayCount,
      pending: pendingCount,
      completedToday,
    };
  }

  private async getDuration(serviceId: string | null | undefined) {
    if (!serviceId) return DEFAULT_DURATION_MIN;
    const service = await this.bookingsRepository.findServiceById(serviceId);
    return service?.duration || DEFAULT_DURATION_MIN;
  }

  /**
   * Rejects bookings on the doctor's days off or outside working hours.
   * Only enforced when the schedule is actually configured (at least one
   * working day) — an all-"not working" default schedule is ignored.
   */
  private async checkDoctorSchedule(
    doctorId: string,
    dateOnly: string,
    time: string,
    duration: number,
  ) {
    const doctor =
      await this.bookingsRepository.findDoctorAvailability(doctorId);
    if (!doctor) throw new NotFoundException('Shifokor topilmadi');
    const problem = scheduleViolation(doctor, dateOnly, time, duration);
    if (problem) throw new BadRequestException(problem);
  }

  private async checkConflicts(
    db: Prisma.TransactionClient | undefined,
    args: {
      doctorId: string;
      date: string;
      time: string;
      duration: number;
      excludeId?: string;
    },
  ) {
    const newStart = timeToMinutes(args.time);
    const newEnd = newStart + args.duration;

    const dayBookings = await this.bookingsRepository.findManyWithService(
      {
        doctorId: args.doctorId,
        date: parseDateOnlyToUTC(args.date),
        id: args.excludeId ? { not: args.excludeId } : undefined,
        status: { in: SLOT_OCCUPYING_STATUSES },
      },
      db,
    );

    for (const b of dayBookings) {
      const bStart = timeToMinutes(b.time);
      const bDuration = b.service?.duration || DEFAULT_DURATION_MIN;
      const bEnd = bStart + bDuration;

      // Overlap? (Start1 < End2) && (End1 > Start2)
      if (newStart < bEnd && newEnd > bStart) {
        throw new ConflictException(
          `Vaqtlar to'qnashuvi: Shifokor bu vaqtda band (${b.time}${bDuration > DEFAULT_DURATION_MIN ? ' - ' + minutesToTime(bEnd) : ''})`,
        );
      }
    }
  }

  private toResponse(b: BookingWithPatient) {
    return {
      id: b.id,
      patientId: b.patientId,
      doctorId: b.doctorId,
      date: toDateOnlyString(b.date),
      time: b.time,
      source: b.source,
      status: b.status,
      notes: b.notes || undefined,
      createdAt: toDateOnlyString(b.createdAt),
      serviceId: b.serviceId ?? undefined,
      patient: toPatientSummary(b.patient),
    };
  }
}
