import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VisitsRepository, VisitWithPatient } from './visits.repository';
import {
  connectActivePatient,
  toPatientSummary,
} from '../patients/patient-summary';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { VisitsQueryDto } from './dto/visits-query.dto';
import { doctorScopeId } from '../common/auth/doctor-scope';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import {
  dateOnlyColumnRange,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';

export const VISIT_NOT_FOUND = 'Tashrif topilmadi';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class VisitsService {
  constructor(private readonly visitsRepository: VisitsRepository) {}

  async findAll(
    query: VisitsQueryDto,
    user: AuthUserView,
  ): Promise<PaginatedResponse<ReturnType<VisitsService['toResponse']>>> {
    const { search, patientId, doctorId, status, startDate, endDate } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.VisitWhereInput = {};

    if (patientId) where.patientId = patientId;

    const scopedDoctorId = doctorScopeId(user);
    if (scopedDoctorId) {
      where.doctorId = scopedDoctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (status && status !== 'all') where.status = status;
    if (startDate || endDate) {
      where.date = dateOnlyColumnRange(startDate, endDate);
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
      ...orderByOption<Prisma.VisitOrderByWithRelationInput[]>(query, 'date'),
    });
    return { data: data.map((v) => this.toResponse(v)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const v = await this.getAccessible(id, user);
    return this.toResponse(v);
  }

  /** A doctor always records visits under their own Doctor id. */
  async create(dto: CreateVisitDto, user: AuthUserView) {
    const scopedDoctorId = doctorScopeId(user);
    const doctorId = scopedDoctorId ?? dto.doctorId;
    const dateStr = dto.date ?? todayInTashkent();
    const v = await this.visitsRepository.create({
      patient: connectActivePatient(dto.patientId),
      doctor: { connect: { id: doctorId } },
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
    await this.getAccessible(id, user);
    // A doctor can't hand a visit over to another doctor.
    const doctorId = doctorScopeId(user) ? undefined : dto.doctorId;
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
          : connectActivePatient(dto.patientId),
      doctor:
        doctorId === undefined ? undefined : { connect: { id: doctorId } },
      booking:
        dto.bookingId === undefined
          ? undefined
          : dto.bookingId
            ? { connect: { id: dto.bookingId } }
            : { disconnect: true },
    });
    return this.toResponse(v);
  }

  private async getAccessible(id: string, user: AuthUserView) {
    const scopedDoctorId = doctorScopeId(user);
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException(VISIT_NOT_FOUND);
    if (scopedDoctorId && v.doctorId !== scopedDoctorId) {
      throw new NotFoundException(VISIT_NOT_FOUND);
    }
    return v;
  }

  private toResponse(v: VisitWithPatient) {
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
      patient: toPatientSummary(v.patient),
    };
  }
}
