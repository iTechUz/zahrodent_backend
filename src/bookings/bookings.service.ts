import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Booking, Prisma, BookingStatus, UserRole } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';

import { PrismaService } from '../database/prisma.service';

import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getStats(user: AuthUserView) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const baseWhere: Prisma.BookingWhereInput = { deletedAt: null };
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN) {
      baseWhere.branchId = user.branchId;
    }
    
    if (user.role === UserRole.DOCTOR) {
      baseWhere.doctorId = user.doctorId;
    }

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
      status?: BookingStatus | string;
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

    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.branchId = user.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (user.role === UserRole.DOCTOR) {
      where.doctorId = user.doctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status as BookingStatus;
    if (source && source !== 'all') where.source = source;

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
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN && b.branchId !== user.branchId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }

    if (user.role === UserRole.DOCTOR && b.doctorId !== user.doctorId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }
    return this.toResponse(b);
  }

  async create(dto: CreateBookingDto, user: AuthUserView) {
    const branchId = user.role === UserRole.SUPER_ADMIN ? dto.branchId : user.branchId;
    if (!branchId) throw new ConflictException('Filial ID ko\'rsatilmadi');

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    // 1. Verify Doctor branch
    const doctor = await this.prisma.doctor.findUnique({ 
      where: { id: dto.doctorId }, 
      include: { user: true } 
    });
    if (!doctor || doctor.user.branchId !== branchId) {
      throw new ForbiddenException('Ushbu shifokor tanlangan filialda ishlamaydi');
    }

    // 2. Verify Patient branch
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient || patient.branchId !== branchId) {
      throw new ForbiddenException('Ushbu bemor tanlangan filialda ro\'yxatda yo\'q');
    }

    // 3. Verify Service branch (if provided)
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service || service.branchId !== branchId) {
        throw new ForbiddenException('Ushbu xizmat tanlangan filialda mavjud emas');
      }
    }

    await this.checkConflicts(dto.doctorId, start, end);

    const b = await this.bookingsRepository.create({
      branch: { connect: { id: branchId } },
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      startTime: start,
      endTime: end,
      source: dto.source,
      status: dto.status,
      notes: dto.notes ?? '',
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
    });

    await this.auditLogs.log({
      branchId: b.branchId,
      userId: user.id,
      action: 'CREATE',
      entity: 'BOOKING',
      entityId: b.id,
      newValue: b,
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

    await this.auditLogs.log({
      branchId: b.branchId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'BOOKING',
      entityId: b.id,
      oldValue: current,
      newValue: b,
    });

    return this.toResponse(b);
  }

  async remove(id: string, user: AuthUserView) {
    const b = await this.ensureExists(id, user);
    await this.bookingsRepository.softDelete(id);

    await this.auditLogs.log({
      branchId: b.branchId,
      userId: user.id,
      action: 'DELETE',
      entity: 'BOOKING',
      entityId: id,
    });

    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const b = await this.bookingsRepository.findById(id);
    if (!b || b.deletedAt) throw new NotFoundException('Booking not found');
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN && b.branchId !== user.branchId) {
      throw new NotFoundException('Booking not found (access restricted)');
    }

    if (user.role === UserRole.DOCTOR && b.doctorId !== user.doctorId) {
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
