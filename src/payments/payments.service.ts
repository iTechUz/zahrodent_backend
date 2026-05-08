import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, PaymentMethod, PaymentType, UserRole } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { AuthUserView } from '../auth/auth.service';
import { getPagination } from '../common/utils/pagination.util';

import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(
    query: PaginationQueryDto & {
      patientId?: string;
      method?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
    user: AuthUserView,
  ) {
    const { skip, take } = getPagination(query);
    const { patientId, method, type, search, startDate, endDate } = query;

    const where: Prisma.PaymentWhereInput = {};
    
    // SaaS Isolation
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.patient = { branchId: user.branchId };
    }

    if (patientId) where.patientId = patientId;
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
      take,
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('To\'lov topilmadi');
    
    if (user.role !== UserRole.SUPER_ADMIN && (p as any).patient.branchId !== user.branchId) {
      throw new ForbiddenException('Boshqa filial to\'loviga kirishga ruxsat yo\'q');
    }
    
    return this.toResponse(p);
  }

  async create(dto: CreatePaymentDto, user: AuthUserView) {
    const branchId = user.role === UserRole.SUPER_ADMIN ? dto.branchId : user.branchId;
    if (!branchId) throw new NotFoundException('Filial ID ko\'rsatilmadi');

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient || patient.branchId !== branchId) {
      throw new NotFoundException('Bemor topilmadi yoki boshqa filialga tegishli');
    }

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          branch: { connect: { id: branchId } },
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

      const isPaid = p.status.toUpperCase() === 'COMPLETED' || p.status.toLowerCase() === 'paid';

      if (isPaid) {
        let adjustment = p.amount;
        if (p.type === 'REFUND' || p.type === 'EXPENSE') {
          adjustment = adjustment.negated();
        }

        await tx.patient.update({
          where: { id: p.patientId },
          data: { balance: { increment: adjustment } },
        });
      }

      await this.auditLogs.log({
        branchId: p.branchId,
        userId: user.id,
        action: 'CREATE',
        entity: 'PAYMENT',
        entityId: p.id,
        newValue: p,
      });

      return this.toResponse(p);
    });
  }

  async update(id: string, dto: UpdatePaymentDto, user: AuthUserView) {
    const current = await this.paymentsRepository.findById(id);
    if (!current) throw new NotFoundException('To\'lov topilmadi');
    
    if (user.role !== UserRole.SUPER_ADMIN && (current as any).patient.branchId !== user.branchId) {
      throw new ForbiddenException('Boshqa filial to\'loviga kirishga ruxsat yo\'q');
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

      const wasPaid = current.status.toUpperCase() === 'COMPLETED' || current.status.toLowerCase() === 'paid';
      const isPaid = updated.status.toUpperCase() === 'COMPLETED' || updated.status.toLowerCase() === 'paid';

      if (wasPaid || isPaid) {
        if (wasPaid) {
          let oldAdj = current.amount;
          if (current.type === 'REFUND' || current.type === 'EXPENSE') {
            oldAdj = oldAdj.negated();
          }
          await tx.patient.update({
            where: { id: current.patientId },
            data: { balance: { decrement: oldAdj } },
          });
        }

        if (isPaid) {
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

      await this.auditLogs.log({
        branchId: updated.branchId,
        userId: user.id,
        action: 'UPDATE',
        entity: 'PAYMENT',
        entityId: id,
        oldValue: current,
        newValue: updated,
      });

      return this.toResponse(updated);
    });
  }

  async remove(id: string, user: AuthUserView) {
    const current = await this.paymentsRepository.findById(id);
    if (!current) throw new NotFoundException('To\'lov topilmadi');

    if (user.role !== UserRole.SUPER_ADMIN && (current as any).patient.branchId !== user.branchId) {
      throw new ForbiddenException('Boshqa filial to\'loviga kirishga ruxsat yo\'q');
    }

    await this.prisma.$transaction(async (tx) => {
      const isPaid = current.status.toUpperCase() === 'COMPLETED' || current.status.toLowerCase() === 'paid';
      if (isPaid) {
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

      await this.auditLogs.log({
        branchId: current.branchId,
        userId: user.id,
        action: 'DELETE',
        entity: 'PAYMENT',
        entityId: id,
        oldValue: current,
      });
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

