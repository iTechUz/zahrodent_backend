import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Visit } from '@prisma/client';
import { VisitsRepository } from './visits.repository';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { toDateOnlyString } from '../common/utils/date.util';

@Injectable()
export class VisitsService {
  constructor(private readonly visitsRepository: VisitsRepository) {}

  findAll(patientId?: string, doctorId?: string) {
    const where: Prisma.VisitWhereInput = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    return this.visitsRepository.findAll(where)
      .then((rows) => rows.map((v) => this.toResponse(v)));
  }

  async findOne(id: string) {
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException('Visit not found');
    return this.toResponse(v);
  }

  async create(dto: CreateVisitDto) {
    const dateStr = dto.date ?? toDateOnlyString(new Date());
    const v = await this.visitsRepository.create({
      patient: { connect: { id: dto.patientId } },
      doctor: { connect: { id: dto.doctorId } },
      booking: dto.bookingId
        ? { connect: { id: dto.bookingId } }
        : undefined,
      date: new Date(dateStr),
      status: dto.status,
      diagnosis: dto.diagnosis ?? '',
      treatment: dto.treatment ?? '',
      notes: dto.notes ?? '',
    });
    return this.toResponse(v);
  }

  async update(id: string, dto: UpdateVisitDto) {
    await this.ensureExists(id);
    const v = await this.visitsRepository.update(id, {
      date: dto.date === undefined ? undefined : new Date(dto.date),
      status: dto.status,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      notes: dto.notes,
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

  private async ensureExists(id: string) {
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException('Visit not found');
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
    };
  }
}
