import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visit } from '@prisma/client';
import { VisitsRepository } from './visits.repository';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import {
  parseDateOnlyToUTC,
  toDateOnlyString,
} from '../common/utils/date.util';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class VisitsService {
  constructor(private readonly visitsRepository: VisitsRepository) {}

  async findAll(
    query: PaginationQueryDto & { patientId?: string; doctorId?: string },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const { search, patientId, doctorId } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.VisitWhereInput = {};

    if (patientId) where.patientId = patientId;

    if (user.role === 'doctor') {
      where.doctorId = user.doctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { diagnosis: { contains: s, mode: 'insensitive' } },
        { treatment: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await this.visitsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((v) => this.toResponse(v)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException('Visit not found');
    if (user.role === 'doctor' && v.doctorId !== user.doctorId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }
    return this.toResponse(v);
  }

  async create(dto: CreateVisitDto) {
    const dateStr = dto.date ?? toDateOnlyString(new Date());
    const v = await this.visitsRepository.create({
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      booking: dto.bookingId ? { connect: { id: dto.bookingId } } : undefined,
      date: parseDateOnlyToUTC(dateStr),
      status: dto.status,
      diagnosis: dto.diagnosis ?? '',
      treatment: dto.treatment ?? '',
      notes: dto.notes ?? '',
      price: dto.price ?? 0,
    });
    return this.toResponse(v);
  }

  async update(id: string, dto: UpdateVisitDto, user: AuthUserView) {
    await this.ensureExists(id, user);
    const v = await this.visitsRepository.update(id, {
      date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
      status: dto.status,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      notes: dto.notes,
      price: dto.price,
      patient:
        dto.patientId === undefined
          ? undefined
          : { connect: { id: dto.patientId } },
      doctor:
        dto.doctorId === undefined
          ? undefined
          : { connect: { id: dto.doctorId } },
      booking:
        dto.bookingId === undefined
          ? undefined
          : dto.bookingId
            ? { connect: { id: dto.bookingId } }
            : { disconnect: true },
    });
    return this.toResponse(v);
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException('Visit not found');
    if (user.role === 'doctor' && v.doctorId !== user.doctorId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }
  }

  private toResponse(v: Visit) {
    return {
      id: v.id,
      patientId: v.patientId,
      doctorId: v.doctorId,
      bookingId: v.bookingId ?? undefined,
      date: toDateOnlyString(v.date),
      status: v.status,
      diagnosis: v.diagnosis,
      treatment: v.treatment,
      notes: v.notes,
      price: v.price || 0,
    };
  }
}
