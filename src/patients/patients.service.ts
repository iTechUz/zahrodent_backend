import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async findAll(
    query: PaginationQueryDto & { 
      source?: string; 
      startDate?: string; 
      endDate?: string;
      branchId?: string;
    },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const { search, source, startDate, endDate, branchId } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.PatientWhereInput = {};

    if (branchId) where.branchId = branchId;
    if (source) where.source = source;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search?.trim()) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (user.role === 'DOCTOR') {
      where.OR = [
        { bookings: { some: { doctorId: user.doctorId } } },
        { visits: { some: { doctorId: user.doctorId } } },
        { assignedDoctorId: user.doctorId }
      ];
    }

    const { data, total } = await this.patientsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const p = await this.patientsRepository.findById(id);
    if (!p || p.deletedAt) throw new NotFoundException('Patient not found');

    if (user.role === 'DOCTOR') {
      const hasAccess = await this.patientsRepository.count({
        id,
        OR: [
          { bookings: { some: { doctorId: user.doctorId } } },
          { visits: { some: { doctorId: user.doctorId } } },
          { assignedDoctorId: user.doctorId }
        ],
      });
      if (!hasAccess) {
        throw new NotFoundException('Patient not found (access restricted)');
      }
    }
    return this.toResponse(p);
  }

  async getStats(user: AuthUserView) {
    const where: Prisma.PatientWhereInput = {};
    if (user.role === 'DOCTOR') {
      where.OR = [
        { bookings: { some: { doctorId: user.doctorId } } },
        { visits: { some: { doctorId: user.doctorId } } },
        { assignedDoctorId: user.doctorId }
      ];
    }
    return this.patientsRepository.getStats(where);
  }

  async create(dto: CreatePatientDto) {
    const existing = await this.patientsRepository.count({ phone: dto.phone });
    if (existing > 0) throw new ConflictException('Bu telefon raqami bilan bemor allaqachon mavjud');

    const p = await this.patientsRepository.create({
      branch: { connect: { id: dto.branchId } },
      user: dto.userId ? { connect: { id: dto.userId } } : undefined,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      source: dto.source || 'DIRECT',
      notes: dto.notes ?? '',
      address: dto.address,
      gender: dto.gender,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      assignedDoctor: dto.assignedDoctorId
        ? { connect: { id: dto.assignedDoctorId } }
        : undefined,
      toothChart: dto.toothChart as object,
      medicalHistory: dto.medicalHistory as object,
    });
    return this.toResponse(p);
  }

  async update(id: string, dto: UpdatePatientDto, user: AuthUserView) {
    const current = await this.ensureExists(id, user);

    if (dto.phone && dto.phone !== current.phone) {
      const existing = await this.patientsRepository.count({ phone: dto.phone, id: { not: id } });
      if (existing > 0) throw new ConflictException('Bu telefon raqami bilan boshqa bemor allaqachon mavjud');
    }

    const p = await this.patientsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      source: dto.source,
      notes: dto.notes,
      address: dto.address,
      gender: dto.gender,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      assignedDoctor: dto.assignedDoctorId
        ? { connect: { id: dto.assignedDoctorId } }
        : dto.assignedDoctorId === null ? { disconnect: true } : undefined,
      toothChart: dto.toothChart as object,
      medicalHistory: dto.medicalHistory as object,
    });
    return this.toResponse(p);
  }

  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    await this.patientsRepository.softDelete(id);
    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const p = await this.patientsRepository.findById(id);
    if (!p || p.deletedAt) throw new NotFoundException('Patient not found');
    return p;
  }

  async addComment(
    data: { content: string; patientId: string },
    authorId: string,
  ) {
    return this.patientsRepository.createComment({
      content: data.content,
      patientId: data.patientId,
      authorId,
    });
  }

  async findComments(patientId: string) {
    return this.patientsRepository.findCommentsByPatientId(patientId);
  }

  private toResponse(p: any) {
    return {
      ...p,
      balance: p.balance?.toNumber() || 0,
      createdAt: p.createdAt?.toISOString(),
      updatedAt: p.updatedAt?.toISOString(),
      birthDate: p.birthDate?.toISOString(),
    };
  }
}
