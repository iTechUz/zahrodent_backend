import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VisitsRepository } from './visits.repository';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { AuthUserView } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VisitsService {
  constructor(
    private readonly visitsRepository: VisitsRepository,
    private readonly prisma: PrismaService,
  ) {}

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

    // Multi-branch isolation
    if (user.role !== 'SUPER_ADMIN') {
      where.patient = { branchId: user.branchId };
    }

    if (user.role === 'DOCTOR') {
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
    
    // Multi-branch isolation
    if (user.role !== 'SUPER_ADMIN' && (v as any).patient.branchId !== user.branchId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }

    if (user.role === 'DOCTOR' && v.doctorId !== user.doctorId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }
    return this.toResponse(v);
  }

  async create(dto: CreateVisitDto) {
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.visit.create({
        data: {
          patient: { connect: { id: dto.patientId } },
          doctor: { connect: { id: dto.doctorId } },
          booking: dto.bookingId ? { connect: { id: dto.bookingId } } : undefined,
          service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
          date: dto.date ? new Date(dto.date) : new Date(),
          diagnosis: dto.diagnosis ?? '',
          treatment: dto.treatment ?? '',
          notes: dto.notes ?? '',
          price: dto.price ?? 0,
        },
      });

      // Update patient balance
      if (dto.price && dto.price > 0) {
        await tx.patient.update({
          where: { id: dto.patientId },
          data: { balance: { decrement: dto.price } },
        });
      }

      return this.toResponse(v);
    });
  }

  async update(id: string, dto: UpdateVisitDto, user: AuthUserView) {
    const current = await this.visitsRepository.findById(id);
    if (!current) throw new NotFoundException('Visit not found');
    if (user.role === 'DOCTOR' && current.doctorId !== user.doctorId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id },
        data: {
          date: dto.date ? new Date(dto.date) : undefined,
          diagnosis: dto.diagnosis,
          treatment: dto.treatment,
          notes: dto.notes,
          price: dto.price,
          patient: dto.patientId ? { connect: { id: dto.patientId } } : undefined,
          doctor: dto.doctorId ? { connect: { id: dto.doctorId } } : undefined,
          booking: dto.bookingId === null 
            ? { disconnect: true } 
            : dto.bookingId ? { connect: { id: dto.bookingId } } : undefined,
          service: dto.serviceId === null
            ? { disconnect: true }
            : dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
        },
      });

      // If price changed, adjust balance
      if (dto.price !== undefined && dto.price !== current.price.toNumber()) {
        const diff = dto.price - current.price.toNumber();
        await tx.patient.update({
          where: { id: updated.patientId },
          data: { balance: { decrement: diff } },
        });
      }

      return this.toResponse(updated);
    });
  }

  async remove(id: string, user: AuthUserView) {
    const current = await this.visitsRepository.findById(id);
    if (!current) throw new NotFoundException('Visit not found');
    if (user.role === 'DOCTOR' && current.doctorId !== user.doctorId) {
      throw new NotFoundException('Visit not found (access restricted)');
    }

    await this.prisma.$transaction(async (tx) => {
      if (current.price.toNumber() > 0) {
        await tx.patient.update({
          where: { id: current.patientId },
          data: { balance: { increment: current.price } },
        });
      }
      await tx.visit.delete({ where: { id } });
    });

    return { id };
  }

  private toResponse(v: any) {
    return {
      ...v,
      price: v.price?.toNumber() || 0,
      date: v.date.toISOString(),
      createdAt: v.createdAt.toISOString(),
    };
  }
}
