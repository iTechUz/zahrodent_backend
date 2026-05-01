import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma, PaymentMethod, PaymentType, UserRole } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    query: PaginationQueryDto & {
      status?: string;
      patientId?: string;
      method?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
    user: AuthUserView,
  ): Promise<PaginatedResponse<any>> {
    const {
      search,
      status,
      patientId,
      method,
      type,
      startDate,
      endDate,
    } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.PaymentWhereInput = {};

    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.patient = { branchId: user.branchId };
    }

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method as PaymentMethod;
    if (type && type !== 'all') where.type = type as PaymentType;

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { firstName: { contains: s, mode: 'insensitive' } },
              { lastName: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const { data, total } = await this.paymentsRepository.findAll({
      where,
      skip,
      take: limitNum,
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN && (p as any).patient.branchId !== user.branchId) {
      throw new NotFoundException('Payment not found (access restricted)');
    }
    
    return this.toResponse(p);
  }

  async create(dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          patient: { connect: { id: dto.patientId } },
          amount: dto.amount,
          discount: dto.discount || 0,
          method: dto.method,
          status: dto.status || 'COMPLETED',
          date: dto.date ? new Date(dto.date) : new Date(),
          description: dto.description,
          type: dto.type || 'INCOME',
          service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
          visit: dto.visitId ? { connect: { id: dto.visitId } } : undefined,
        },
        include: { patient: true }
      });

      // Update patient balance
      if (p.status === 'COMPLETED') {
        let adjustment = p.amount;
        if (p.type === 'REFUND' || p.type === 'EXPENSE') {
          adjustment = adjustment.negated();
        }

        await tx.patient.update({
          where: { id: p.patientId },
          data: { balance: { increment: adjustment } },
        });
      }

      return this.toResponse(p);
    });
  }

  async update(id: string, dto: UpdatePaymentDto, user: AuthUserView) {
    const current = await this.paymentsRepository.findById(id);
    if (!current) throw new NotFoundException('Payment not found');
    
    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN && (current as any).patient.branchId !== user.branchId) {
      throw new NotFoundException('Payment not found (access restricted)');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          amount: dto.amount,
          discount: dto.discount,
          method: dto.method,
          status: dto.status,
          description: dto.description,
          type: dto.type,
          date: dto.date ? new Date(dto.date) : undefined,
          patient: dto.patientId ? { connect: { id: dto.patientId } } : undefined,
          service: dto.serviceId === null 
            ? { disconnect: true } 
            : dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
          visit: dto.visitId === null
            ? { disconnect: true }
            : dto.visitId ? { connect: { id: dto.visitId } } : undefined,
        },
        include: { patient: true }
      });

      // Revert old balance adjustment and apply new one
      if (current.status === 'COMPLETED' || updated.status === 'COMPLETED') {
        // Revert old
        if (current.status === 'COMPLETED') {
          let oldAdj = current.amount;
          if (current.type === 'REFUND' || current.type === 'EXPENSE') {
            oldAdj = oldAdj.negated();
          }
          await tx.patient.update({
            where: { id: current.patientId },
            data: { balance: { decrement: oldAdj } },
          });
        }

        // Apply new
        if (updated.status === 'COMPLETED') {
          let newAdj = updated.amount;
          if (updated.type === 'REFUND' || updated.type === 'EXPENSE') {
            newAdj = newAdj.negated();
          }
          await tx.patient.update({
            where: { id: updated.patientId },
            data: { balance: { increment: newAdj } },
          });
        }
      }

      return this.toResponse(updated);
    });
  }

  async remove(id: string, user: AuthUserView) {
    const current = await this.paymentsRepository.findById(id);
    if (!current) throw new NotFoundException('Payment not found');

    // Multi-branch isolation
    if (user.role !== UserRole.SUPER_ADMIN && (current as any).patient.branchId !== user.branchId) {
      throw new NotFoundException('Payment not found (access restricted)');
    }

    await this.prisma.$transaction(async (tx) => {
      if (current.status === 'COMPLETED') {
        let adjustment = current.amount;
        if (current.type === 'REFUND' || current.type === 'EXPENSE') {
          adjustment = adjustment.negated();
        }
        await tx.patient.update({
          where: { id: current.patientId },
          data: { balance: { decrement: adjustment } },
        });
      }
      await tx.payment.delete({ where: { id } });
    });

    return { id };
  }

  async getStats(user: AuthUserView) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const where: Prisma.PaymentWhereInput = {};
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.patient = { branchId: user.branchId };
    }

    const [totalRevenue, pendingAmount, todayRevenue] = await Promise.all([
      this.paymentsRepository.sumAmount({ ...where, status: 'COMPLETED' }),
      this.paymentsRepository.sumAmount({
        ...where,
        status: { not: 'COMPLETED' },
      }),
      this.paymentsRepository.sumAmount({
        ...where,
        status: 'COMPLETED',
        date: { gte: today, lt: tomorrow },
      }),
    ]);

    return {
      totalRevenue: totalRevenue || 0,
      pendingAmount: pendingAmount || 0,
      todayRevenue: todayRevenue || 0,
    };
  }

  async getDoctorStats(user: AuthUserView) {
    return this.paymentsRepository.getDoctorStats();
  }

  private toResponse(p: any) {
    return {
      ...p,
      amount: p.amount?.toNumber() || 0,
      discount: p.discount?.toNumber() || 0,
      date: p.date.toISOString(),
      createdAt: p.createdAt.toISOString(),
    };
  }
}
