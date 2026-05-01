import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma, PaymentMethod, PaymentType } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async findAll(
    query: PaginationQueryDto & {
      status?: string;
      patientId?: string;
      method?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
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

    const { data, total } = await this.paymentsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    return this.toResponse(p);
  }

  async create(dto: CreatePaymentDto) {
    const p = await this.paymentsRepository.create({
      patient: { connect: { id: dto.patientId } },
      amount: dto.amount,
      discount: dto.discount || 0,
      method: dto.method,
      status: dto.status,
      date: dto.date ? new Date(dto.date) : new Date(),
      description: dto.description,
      type: dto.type || 'INCOME',
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
      visit: dto.visitId ? { connect: { id: dto.visitId } } : undefined,
    });
    return this.toResponse(p);
  }

  async update(id: string, dto: UpdatePaymentDto) {
    await this.ensureExists(id);
    const p = await this.paymentsRepository.update(id, {
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
    });
    return this.toResponse(p);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.paymentsRepository.delete(id);
    return { id };
  }

  async getStats() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [totalRevenue, pendingAmount, todayRevenue] = await Promise.all([
      this.paymentsRepository.sumAmount({ status: 'COMPLETED' }),
      this.paymentsRepository.sumAmount({
        status: { not: 'COMPLETED' },
      }),
      this.paymentsRepository.sumAmount({
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

  async getDoctorStats() {
    return this.paymentsRepository.getDoctorStats();
  }

  private async ensureExists(id: string) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
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
