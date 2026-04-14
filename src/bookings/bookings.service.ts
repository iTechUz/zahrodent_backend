import { Injectable, NotFoundException } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { toDateOnlyString } from '../common/utils/date.util';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

  async findAll(query: {
    search?: string;
    status?: string;
    source?: string;
    patientId?: string;
    limit?: number;
  }) {
    const where: Prisma.BookingWhereInput = {};
    if (query.patientId) {
      where.patientId = query.patientId;
    }
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }
    if (query.source && query.source !== 'all') {
      where.source = query.source;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.patient = {
        OR: [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
        ],
      };
    }
    const take =
      query.limit != null && Number.isFinite(query.limit)
        ? Math.min(500, Math.max(1, Math.floor(query.limit)))
        : undefined;
    const rows = await this.bookingsRepository.findAll(where, { take });
    return rows.map((b) => this.toResponse(b));
  }

  async findOne(id: string) {
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
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

  async update(id: string, dto: UpdateBookingDto) {
    await this.ensureExists(id);
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

  async remove(id: string) {
    await this.ensureExists(id);
    await this.bookingsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const b = await this.bookingsRepository.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
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
