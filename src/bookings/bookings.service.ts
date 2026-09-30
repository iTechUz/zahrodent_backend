import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BookingsRepository, BookingWithPatient } from './bookings.repository';
import {
  connectActivePatient,
  toPatientSummary,
} from '../patients/patient-summary';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import {
  dateOnlyColumnRange,
  parseDateOnlyToUTC,
  relativeDateRange,
  scheduleWeekday,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';
import { doctorScopeId } from '../common/auth/doctor-scope';

/** Statuses that occupy the doctor's time slot. */
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
const DEFAULT_DURATION_MIN = 30;

export const BOOKING_NOT_FOUND = 'Qabul topilmadi';

type ScheduleSlot = {
  day: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
};

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

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
      where.patient = {
        OR: [
          { firstName: { contains: search.trim(), mode: 'insensitive' } },
          { lastName: { contains: search.trim(), mode: 'insensitive' } },
        ],
      };
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
      ...orderByOption<Prisma.BookingOrderByWithRelationInput[]>(query, 'date'),
    });
    return { data: data.map((b) => this.toResponse(b)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const b = await this.getAccessible(id, user);
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto) {
    if (dto.date < todayInTashkent()) {
      throw new BadRequestException("O'tgan sanaga qabul yaratib bo'lmaydi");
    }
    const duration = await this.getDuration(dto.serviceId);
    await this.checkDoctorSchedule(dto.doctorId, dto.date, dto.time, duration);

    const b = await this.bookingsRepository.withDoctorDayLock(
      dto.doctorId,
      dto.date,
      async (tx) => {
        if (ACTIVE_BOOKING_STATUSES.includes(dto.status)) {
          await this.checkConflicts(tx, {
            doctorId: dto.doctorId,
            date: dto.date,
            time: dto.time,
            duration,
          });
        }
        return this.bookingsRepository.create(
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
            createdAt: parseDateOnlyToUTC(todayInTashkent()),
          },
          tx,
        );
      },
    );
    return this.toResponse(b);
  }

  async update(id: string, dto: UpdateBookingDto, user: AuthUserView) {
    const current = await this.getAccessible(id, user);

    const next = {
      doctorId: dto.doctorId ?? current.doctorId,
      date: dto.date ?? toDateOnlyString(current.date),
      time: dto.time ?? current.time,
      serviceId:
        dto.serviceId === undefined ? current.serviceId : dto.serviceId || null,
      status: dto.status ?? current.status,
    };
    const slotChanged =
      next.doctorId !== current.doctorId ||
      next.date !== toDateOnlyString(current.date) ||
      next.time !== current.time ||
      next.serviceId !== current.serviceId;
    // e.g. cancelled → pending: the slot may have been taken meanwhile.
    const reactivated =
      !ACTIVE_BOOKING_STATUSES.includes(current.status) &&
      ACTIVE_BOOKING_STATUSES.includes(next.status);
    const mustCheck =
      ACTIVE_BOOKING_STATUSES.includes(next.status) &&
      (slotChanged || reactivated);

    const data: Prisma.BookingUpdateInput = {
      date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
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

    if (!mustCheck) {
      const b = await this.bookingsRepository.update(id, data);
      return this.toResponse(b);
    }

    const duration = await this.getDuration(next.serviceId);
    if (slotChanged) {
      await this.checkDoctorSchedule(
        next.doctorId,
        next.date,
        next.time,
        duration,
      );
    }
    const b = await this.bookingsRepository.withDoctorDayLock(
      next.doctorId,
      next.date,
      async (tx) => {
        await this.checkConflicts(tx, {
          doctorId: next.doctorId,
          date: next.date,
          time: next.time,
          duration,
          excludeId: id,
        });
        return this.bookingsRepository.update(id, data, tx);
      },
    );
    return this.toResponse(b);
  }

  async remove(id: string, user: AuthUserView) {
    await this.getAccessible(id, user);
    await this.bookingsRepository.delete(id);
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
      this.bookingsRepository.count({ ...baseWhere, date: today }),
      this.bookingsRepository.count({ ...baseWhere, status: 'pending' }),
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

    const daysOff = Array.isArray(doctor.daysOff)
      ? (doctor.daysOff as unknown[]).map((d) => String(d).trim())
      : [];
    if (daysOff.includes(dateOnly)) {
      throw new BadRequestException(
        `Shifokor ${dateOnly} kuni dam oladi — boshqa sanani tanlang`,
      );
    }

    const schedule = Array.isArray(doctor.schedule)
      ? (doctor.schedule as unknown as ScheduleSlot[])
      : [];
    if (!schedule.some((s) => s?.isWorking)) return;

    const slot = schedule.find(
      (s) => Number(s?.day) === scheduleWeekday(dateOnly),
    );
    if (!slot) return;
    if (!slot.isWorking) {
      throw new BadRequestException('Shifokor bu hafta kunida ishlamaydi');
    }
    const start = this.timeToMinutes(String(slot.startTime).slice(0, 5));
    const end = this.timeToMinutes(String(slot.endTime).slice(0, 5));
    const bookingStart = this.timeToMinutes(time);
    if (Number.isNaN(start) || Number.isNaN(end)) return;
    if (bookingStart < start || bookingStart + duration > end) {
      throw new BadRequestException(
        `Qabul vaqti shifokorning ish vaqtidan tashqarida (${this.minutesToTime(start)}–${this.minutesToTime(end)})`,
      );
    }
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
    const newStart = this.timeToMinutes(args.time);
    const newEnd = newStart + args.duration;

    const dayBookings = await this.bookingsRepository.findManyWithService(
      {
        doctorId: args.doctorId,
        date: parseDateOnlyToUTC(args.date),
        id: args.excludeId ? { not: args.excludeId } : undefined,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      db,
    );

    for (const b of dayBookings) {
      const bStart = this.timeToMinutes(b.time);
      const bDuration = b.service?.duration || DEFAULT_DURATION_MIN;
      const bEnd = bStart + bDuration;

      // Overlap? (Start1 < End2) && (End1 > Start2)
      if (newStart < bEnd && newEnd > bStart) {
        throw new ConflictException(
          `Vaqtlar to'qnashuvi: Shifokor bu vaqtda band (${b.time}${bDuration > DEFAULT_DURATION_MIN ? ' - ' + this.minutesToTime(bEnd) : ''})`,
        );
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
