import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly prisma: PrismaService,
  ) {}

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

    const where: Prisma.PatientWhereInput = { deletedAt: null };

    // SaaS Isolation
    if (user.role !== 'SUPER_ADMIN') {
      where.branchId = user.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (source && source !== 'all') where.source = source;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const debtOnly = (query as any).debtOnly === 'true';

    if (search?.trim()) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    // Debt filter
    if (debtOnly) {
      where.balance = { lt: 0 };
    }

    // Doctor sees only their own patients — combine with AND to not break search
    if (user.role === 'DOCTOR') {
      const doctorFilter: Prisma.PatientWhereInput = {
        OR: [
          { bookings: { some: { doctorId: user.doctorId } } },
          { visits: { some: { doctorId: user.doctorId } } },
          { assignedDoctorId: user.doctorId },
        ],
      };
      // Merge with existing AND conditions
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        doctorFilter,
      ];
    }

    const { data, total } = await this.patientsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const p = await this.ensureExists(id, user);
    return this.toResponse(p);
  }

  async getStats(user: AuthUserView) {
    const where: Prisma.PatientWhereInput = { deletedAt: null };
    if (user.role !== 'SUPER_ADMIN') {
      where.branchId = user.branchId;
    }
    if (user.role === 'DOCTOR') {
      const doctorFilter: Prisma.PatientWhereInput = {
        OR: [
          { bookings: { some: { doctorId: user.doctorId } } },
          { visits: { some: { doctorId: user.doctorId } } },
          { assignedDoctorId: user.doctorId },
        ],
      };
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        doctorFilter,
      ];
    }
    return this.patientsRepository.getStats(where);
  }

  async create(dto: CreatePatientDto, user: AuthUserView) {
    // Force branchId for non-SuperAdmin
    const branchId = user.role === 'SUPER_ADMIN' ? dto.branchId : user.branchId;
    const normalizedPhone = dto.phone.replace(/\D/g, '');
    
    const existing = await this.patientsRepository.count({ 
      phone: normalizedPhone, 
      branchId, // Phone must be unique within a branch
      deletedAt: null 
    });
    if (existing > 0) throw new ConflictException('Bu telefon raqami bilan bemor ushbu filialda mavjud');

    if (dto.assignedDoctorId) {
      const doctor = await this.prisma.doctor.findUnique({ 
        where: { id: dto.assignedDoctorId },
        include: { user: true } 
      });
      if (!doctor || doctor.user.branchId !== branchId) {
        throw new ForbiddenException('Ushbu shifokor tanlangan filialda ishlamaydi');
      }
    }

    const p = await this.patientsRepository.create({
      branch: { connect: { id: branchId } },
      user: dto.userId ? { connect: { id: dto.userId } } : undefined,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: normalizedPhone,
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

    if (dto.phone) {
      const normalizedPhone = dto.phone.replace(/\D/g, '');
      if (normalizedPhone !== current.phone) {
        const existing = await this.patientsRepository.count({ 
          phone: normalizedPhone, 
          branchId: current.branchId,
          id: { not: id },
          deletedAt: null
        });
        if (existing > 0) throw new ConflictException('Bu telefon raqami bilan boshqa bemor ushbu filialda mavjud');
      }
    }

    const p = await this.patientsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ? dto.phone.replace(/\D/g, '') : undefined,
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
    const p = await this.ensureExists(id, user);
    
    return this.prisma.$transaction(async (tx) => {
      // 1. If patient has a user account, deactivate it
      if (p.userId) {
        await tx.user.update({
          where: { id: p.userId },
          data: { isActive: false, deletedAt: new Date() }
        });
      }

      // 2. Soft delete patient
      await tx.patient.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      return { id };
    });
  }

  private async ensureExists(id: string, user: AuthUserView) {
    const p = await this.patientsRepository.findById(id);
    if (!p || p.deletedAt) throw new NotFoundException('Patient not found');

    // SaaS Isolation
    if (user.role !== 'SUPER_ADMIN' && p.branchId !== user.branchId) {
      throw new ForbiddenException('Boshqa filial bemoriga kirishga ruxsat yo\'q');
    }

    // Doctor specific isolation
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
        throw new ForbiddenException('Siz ushbu bemorga mas\'ul emassiz');
      }
    }

    return p;
  }

  async addComment(
    data: { content: string; patientId: string },
    user: AuthUserView,
  ) {
    const p = await this.ensureExists(data.patientId, user);
    return this.patientsRepository.createComment({
      content: data.content,
      patientId: data.patientId,
      authorId: user.id,
      branchId: p.branchId,
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
