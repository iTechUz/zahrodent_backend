import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { toDateOnlyString } from '../common/utils/date.util';
import { PaginatedResponse, PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async findAll(
    query: PaginationQueryDto & { source?: string },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
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

    if (user.role === 'doctor') {
      where.OR = undefined; // Clear the previous OR to avoid conflicts if needed, but better to combine
      where.AND = [
        {
          OR: [
            { bookings: { some: { doctorId: user.id } } },
            { visits: { some: { doctorId: user.id } } },
          ],
        },
      ];
      if (search?.trim()) {
        (where.AND as any[]).push({
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
    }

    const { data, total } = await this.patientsRepository.findAll(where, { skip, take: limitNum });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException('Patient not found');

    if (user.role === 'doctor') {
      // Check if patient has any association with this doctor
      const hasAccess = await this.patientsRepository.count({
        id,
        OR: [
          { bookings: { some: { doctorId: user.id } } },
          { visits: { some: { doctorId: user.id } } },
        ],
      });
      if (!hasAccess) {
        throw new NotFoundException('Patient not found (access restricted)');
      }
    }
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

  async update(id: string, dto: UpdatePatientDto, user: AuthUserView) {
    await this.ensureExists(id, user);
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

  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    await this.patientsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    await this.findOne(id, user);
  }

  async getStats(user: AuthUserView) {
    const where: Prisma.PatientWhereInput = {};
    if (user.role === 'doctor') {
      where.OR = [
        { bookings: { some: { doctorId: user.id } } },
        { visits: { some: { doctorId: user.id } } },
      ];
    }

    const total = await this.patientsRepository.count(where);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonth = await this.patientsRepository.count({
      ...where,
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
