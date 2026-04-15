import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { toDateOnlyString } from '../common/utils/date.util';
import { PaginationQueryDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async findAll(query: PaginationQueryDto & {
    status?: string;
    patientId?: string;
    method?: string;
    dateRange?: 'today' | 'week' | 'month' | 'all';
  }): Promise<PaginatedResponse<any>> {
    const { page = 0, limit = 10, search, status, patientId, method, dateRange = 'all' } = query;
    const skip = page * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;

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

    if (dateRange !== 'all') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();

      if (dateRange === 'today') {
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        const day = start.getDay() || 7;
        if (day !== 1) start.setHours(-24 * (day - 1));
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'month') {
        start.setDate(1);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
      }

      where.date = { gte: start, lte: end };
    }

    const { data, total } = await this.paymentsRepository.findAll(where, { skip, take: limit });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    return this.toResponse(p);
  }

  async create(dto: CreatePaymentDto) {
    const dateStr = dto.date ?? toDateOnlyString(new Date());
    const p = await this.paymentsRepository.create({
      patient: { connect: { id: dto.patientId } },
      amount: dto.amount,
      method: dto.method,
      status: dto.status,
      date: new Date(dateStr),
      description: dto.description,
      discount: dto.discount,
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
    });
    return this.toResponse(p);
  }

  async update(id: string, dto: UpdatePaymentDto) {
    await this.ensureExists(id);
    const p = await this.paymentsRepository.update(id, {
      amount: dto.amount,
      method: dto.method,
      status: dto.status,
      description: dto.description,
      discount: dto.discount,
      date: dto.date === undefined ? undefined : new Date(dto.date),
      patient:
        dto.patientId === undefined
          ? undefined
          : { connect: { id: dto.patientId } },
      service:
        dto.serviceId === undefined
          ? undefined
          : dto.serviceId
            ? { connect: { id: dto.serviceId } }
            : { disconnect: true },
    });
    return this.toResponse(p);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.paymentsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
  }

  private toResponse(p: Payment) {
    return {
      id: p.id,
      patientId: p.patientId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: toDateOnlyString(p.date),
      description: p.description,
      discount: p.discount ?? undefined,
      serviceId: p.serviceId ?? undefined,
    };
  }
}
