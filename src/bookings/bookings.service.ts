import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Booking, Prisma, BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

  async getStats(user: AuthUserView) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const baseWhere: Prisma.BookingWhereInput = { deletedAt: null };
    if (user.role === 'DOCTOR') baseWhere.doctorId = user.doctorId;

    const [todayCount, pendingCount, completedTodayCount] = await Promise.all([
      this.bookingsRepository.count({
        ...baseWhere,
        startTime: { gte: today, lt: tomorrow },
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'PENDING',
      }),
      this.bookingsRepository.count({
        ...baseWhere,
        status: 'COMPLETED',
        startTime: { gte: today, lt: tomorrow },
      }),
    ]);

    return {
      today: todayCount,
      pending: pendingCount,
      completedToday: completedTodayCount,
    };
  }

  async findAll(
    query: PaginationQueryDto & {
      status?: BookingStatus;
      source?: string;
      patientId?: string;
      doctorId?: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
    },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const { search, status, source, patientId, doctorId, branchId, startDate, endDate } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.BookingWhereInput = {};

    if (user.role === 'DOCTOR') {
      where.doctorId = user.doctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (branchId) where.branchId = branchId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (source) where.source = source;

    if (search?.trim()) {
      where.patient = {
        OR: [
          { firstName: { contains: search.trim(), mode: 'insensitive' } },
          { lastName: { contains: search.trim(), mode: 'insensitive' } },
          { phone: { contains: search.trim() } },
        ],
      };
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const { data, total } = await this.bookingsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((b) => this.toResponse(b)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b || b.deletedAt) throw new NotFoundException('Booking not found');
    
    if (user.role === 'DOCTOR' && b.doctorId !== user.doctorId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    await this.checkConflicts(dto.doctorId, start, end);

    const b = await this.bookingsRepository.create({
      branch: { connect: { id: dto.branchId } },
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      startTime: start,
      endTime: end,
      source: dto.source,
      status: dto.status,
      notes: dto.notes ?? '',
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
    });
    return this.toResponse(b);
  }

  async update(id: string, dto: UpdateBookingDto, user: AuthUserView) {
    const current = await this.ensureExists(id, user);

    if (dto.startTime || dto.endTime || dto.doctorId) {
      const start = dto.startTime ? new Date(dto.startTime) : current.startTime;
      const end = dto.endTime ? new Date(dto.endTime) : current.endTime;
      const docId = dto.doctorId ?? current.doctorId;

      await this.checkConflicts(docId, start, end, id);
    }

    const b = await this.bookingsRepository.update(id, {
      startTime: dto.startTime ? new Date(dto.startTime) : undefined,
      endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      source: dto.source,
      status: dto.status,
      notes: dto.notes,
      branch: dto.branchId ? { connect: { id: dto.branchId } } : undefined,
      patient: dto.patientId ? { connect: { id: dto.patientId } } : undefined,
      doctor: dto.doctorId ? { connect: { id: dto.doctorId } } : undefined,
      service: dto.serviceId === null 
        ? { disconnect: true } 
        : dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
    });
    return this.toResponse(b);
  }

  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    await this.bookingsRepository.softDelete(id);
    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b || b.deletedAt) throw new NotFoundException('Booking not found');
    if (user.role === 'DOCTOR' && b.doctorId !== user.doctorId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
    return b;
  }

  private async checkConflicts(
    doctorId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ) {
    const conflicts = await this.bookingsRepository.findManyWithService({
      doctorId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      OR: [
        {
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } }
          ]
        }
      ]
    });

    if (conflicts.length > 0) {
      throw new ConflictException(
        `Vaqtlar to'qnashuvi: Shifokor bu vaqtda band.`
      );
    }
  }

  private toResponse(b: any) {
    return {
      id: b.id,
      branchId: b.branchId,
      patientId: b.patientId,
      doctorId: b.doctorId,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      source: b.source,
      status: b.status,
      notes: b.notes || undefined,
      createdAt: b.createdAt.toISOString(),
      serviceId: b.serviceId ?? undefined,
      patient: b.patient,
      doctor: b.doctor,
      service: b.service,
    };
  }
}
