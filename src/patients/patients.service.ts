import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { toDateOnlyString } from '../common/utils/date.util';
import { PaginatedResponse, PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async findAll(query: PaginationQueryDto & { source?: string }): Promise<PaginatedResponse<any>> {
    const { search, source } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.PatientWhereInput = {};

    if (source && source !== 'all') {
      where.source = source;
    }

    if (search?.trim()) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await this.patientsRepository.findAll(where, { skip, take: limitNum });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string) {
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException('Patient not found');
    return this.toResponse(p);
  }

  async create(dto: CreatePatientDto) {
    const p = await this.patientsRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      phone: dto.phone,
      source: dto.source,
      notes: dto.notes ?? '',
      allergies: dto.allergies,
      bloodType: dto.bloodType,
      avatar: dto.avatar,
      toothChart:
        dto.toothChart === undefined ? undefined : (dto.toothChart as object),
    });
    return this.toResponse(p);
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.ensureExists(id);
    const p = await this.patientsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      phone: dto.phone,
      source: dto.source,
      notes: dto.notes,
      allergies: dto.allergies,
      bloodType: dto.bloodType,
      avatar: dto.avatar,
      toothChart:
        dto.toothChart === undefined ? undefined : (dto.toothChart as object),
    });
    return this.toResponse(p);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.patientsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException('Patient not found');
  }

  async getStats() {
    const total = await this.patientsRepository.count();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonth = await this.patientsRepository.count({
      createdAt: { gte: startOfMonth },
    });

    // Top source
    const sources = await this.patientsRepository.groupBySource();
    const topSource = sources[0]?.source || 'N/A';

    return {
      total,
      newThisMonth,
      topSource,
    };
  }

  private toResponse(p: Patient) {
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      phone: p.phone,
      source: p.source,
      notes: p.notes,
      avatar: p.avatar ?? undefined,
      createdAt: toDateOnlyString(p.createdAt),
      allergies: p.allergies ?? undefined,
      bloodType: p.bloodType ?? undefined,
      toothChart: (p.toothChart as Record<number, unknown> | null) ?? undefined,
    };
  }
}
