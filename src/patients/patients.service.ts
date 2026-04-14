import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { toDateOnlyString } from '../common/utils/date.util';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async findAll(search?: string, limit?: number) {
    const where: Prisma.PatientWhereInput | undefined = search?.trim()
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const take =
      limit != null && Number.isFinite(limit)
        ? Math.min(500, Math.max(1, Math.floor(limit)))
        : undefined;
    const rows = await this.patientsRepository.findAll(where, { take });
    return rows.map((p) => this.toResponse(p));
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
      toothChart: dto.toothChart === undefined ? undefined : (dto.toothChart as object),
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
