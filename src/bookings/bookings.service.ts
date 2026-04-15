import { Injectable, NotFoundException } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { toDateOnlyString } from '../common/utils/date.util';
import { PaginationQueryDto, PaginatedResponse } from '../common/dto/pagination.dto';
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
    },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const { search, status, source, patientId, dateRange = 'all' } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.BookingWhereInput = {};

    if (user.role === 'doctor') {
      where.doctorId = user.id;
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

    if (dateRange !== 'all') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();

      if (dateRange === 'today') {
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        // Start of week (Monday)
        const day = start.getDay() || 7;
        if (day !== 1) start.setHours(-24 * (day - 1));
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'month') {
        start.setDate(1);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
      }

      where.date = { gte: start, lte: end };
    }

    const { data, total } = await this.bookingsRepository.findAll(where, { skip, take: limitNum });
    return { data: data.map((b) => this.toResponse(b)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (user.role === 'doctor' && b.doctorId !== user.id) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto) {
    const b = await this.bookingsRepository.create({
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      date: new Date(dto.date),
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
    const b = await this.bookingsRepository.update(id, {
      date: dto.date === undefined ? undefined : new Date(dto.date),
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
    if (user.role === 'doctor' && b.doctorId !== user.id) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
  }

  async getStats(user: AuthUserView) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const baseWhere: Prisma.BookingWhereInput = {};
    if (user.role === 'doctor') {
      baseWhere.doctorId = user.id;
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
