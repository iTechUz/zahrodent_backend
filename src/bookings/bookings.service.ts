import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  endOfUTCDayInclusive,
  parseDateOnlyToUTC,
  startOfUTCDay,
  toDateOnlyString,
} from '../common/utils/date.util';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

  async findAll(
    query: PaginationQueryDto & {
      status?: string;
      source?: string;
      patientId?: string;
      dateRange?: 'today' | 'week' | 'month' | 'all';
      startDate?: string;
      endDate?: string;
    },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const { search, status, source, patientId, dateRange = 'all', startDate, endDate } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.BookingWhereInput = {};

    if (user.role === 'doctor') {
      where.doctorId = user.doctorId;
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
      where.date = {};
      if (startDate) where.date.gte = parseDateOnlyToUTC(startDate);
      if (endDate) where.date.lte = parseDateOnlyToUTC(endDate);
    } else if (dateRange !== 'all') {
      const now = new Date();
      const start = startOfUTCDay(now);
      let end = endOfUTCDayInclusive(now);

      if (dateRange === 'week') {
        // Start of week (Monday) in UTC
        const day = start.getUTCDay() || 7; // 1=Mon ... 0=Sun => 7
        if (day !== 1) start.setUTCDate(start.getUTCDate() - (day - 1));
        end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        end = endOfUTCDayInclusive(end);
      } else if (dateRange === 'month') {
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEndDate = new Date(Date.UTC(year, month + 1, 0));
        // Ensure full-day boundaries in UTC
        start.setTime(monthStart.getTime());
        end = endOfUTCDayInclusive(monthEndDate);
      }

      where.date = { gte: start, lte: end };
    }

    const { data, total } = await this.bookingsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((b) => this.toResponse(b)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (user.role === 'doctor' && b.doctorId !== user.doctorId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto) {
    await this.checkConflicts(dto.doctorId, dto.date, dto.time, dto.serviceId);

    const b = await this.bookingsRepository.create({
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      date: parseDateOnlyToUTC(dto.date),
      time: dto.time,
      source: dto.source,
      status: dto.status,
      notes: dto.notes ?? '',
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
    });
    return this.toResponse(b);
  }

  async update(id: string, dto: UpdateBookingDto, user: AuthUserView) {
    await this.ensureExists(id, user);

    if (dto.date || dto.time || dto.doctorId || dto.serviceId) {
      const current = await this.bookingsRepository.findById(id);
      await this.checkConflicts(
        dto.doctorId ?? current!.doctorId,
        dto.date ?? current!.date,
        dto.time ?? current!.time,
        dto.serviceId === undefined ? current!.serviceId : dto.serviceId,
        id,
      );
    }

    const b = await this.bookingsRepository.update(id, {
      date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
      time: dto.time,
      source: dto.source,
      status: dto.status,
      notes: dto.notes,
      patient:
        dto.patientId === undefined
          ? undefined
          : { connect: { id: dto.patientId } },
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
    });
    return this.toResponse(b);
  }

  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    await this.bookingsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (user.role === 'doctor' && b.doctorId !== user.doctorId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
  }

  async getStats(user: AuthUserView) {
    const now = new Date();
    const today = startOfUTCDay(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    const baseWhere: Prisma.BookingWhereInput = {};
    if (user.role === 'doctor') {
      baseWhere.doctorId = user.doctorId;
    }

    const [todayCount, pendingCount, completedToday] = await Promise.all([
      this.bookingsRepository.count({
        ...baseWhere,
        date: { gte: today, lt: tomorrow },
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'pending',
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'completed',
        date: { gte: today, lt: tomorrow },
      }),
    ]);

    return {
      today: todayCount,
      pending: pendingCount,
      completedToday,
    };
  }

  private async checkConflicts(
    doctorId: string,
    date: Date | string,
    time: string,
    serviceId: string | null | undefined,
    excludeId?: string,
  ) {
    const bookingDate =
      typeof date === 'string' ? parseDateOnlyToUTC(date) : date;
    bookingDate.setUTCHours(0, 0, 0, 0);

    // Get new booking duration
    let duration = 30; // Default
    if (serviceId) {
      const service = await this.bookingsRepository.findServiceById(serviceId);
      if (service) duration = service.duration;
    }

    const newStart = this.timeToMinutes(time);
    const newEnd = newStart + duration;

    // Get all bookings for that doctor on that day
    // We need to fetch services too to know their durations
    const dayBookings = await this.bookingsRepository.findManyWithService({
      doctorId,
      date: bookingDate,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ['pending', 'confirmed'] }, // Only check active ones
    });

    for (const b of dayBookings) {
      const bStart = this.timeToMinutes(b.time);
      const bDuration = (b as any).service?.duration || 30;
      const bEnd = bStart + bDuration;

      // Overlap? (Start1 < End2) && (End1 > Start2)
      if (newStart < bEnd && newEnd > bStart) {
        throw new ConflictException(
          `Vaqtlar to'qnashuvi: Shifokor bu vaqtda band (${b.time}${bDuration > 30 ? ' - ' + this.minutesToTime(bEnd) : ''})`,
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

  private toResponse(b: Booking) {
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
    };
  }
}
