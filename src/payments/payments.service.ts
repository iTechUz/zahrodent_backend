import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import {
  endOfUTCDayInclusive,
  parseDateOnlyToUTC,
  startOfUTCDay,
  toDateOnlyString,
} from '../common/utils/date.util';
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
      dateRange?: 'today' | 'week' | 'month' | 'all';
    },
  ): Promise<PaginatedResponse<any>> {
    const { search, status, patientId, method, type, dateRange = 'all' } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.PaymentWhereInput = {};

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;
    if (type && type !== 'all') where.type = type;

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
      const now = new Date();
      const start = startOfUTCDay(now);
      let end = endOfUTCDayInclusive(now);

      if (dateRange === 'week') {
        // Start of week (Monday) in UTC
        const day = start.getUTCDay() || 7; // 1=Mon ... 0=Sun => 7
        if (day !== 1) start.setUTCDate(start.getUTCDate() - (day - 1));
        end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        end = endOfUTCDayInclusive(end);
      } else if (dateRange === 'month') {
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEndDate = new Date(Date.UTC(year, month + 1, 0));
        start.setTime(monthStart.getTime());
        end = endOfUTCDayInclusive(monthEndDate);
      }

      where.date = { gte: start, lte: end };
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
    const dateStr = dto.date ?? toDateOnlyString(new Date());
    const p = await this.paymentsRepository.create({
      patient: { connect: { id: dto.patientId } },
      amount: dto.amount,
      method: dto.method,
      status: dto.status,
      date: parseDateOnlyToUTC(dateStr),
      description: dto.description,
      type: dto.type || 'INCOME',
      discount: dto.discount,
      service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
      visit: dto.visitId ? { connect: { id: dto.visitId } } : undefined,
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
      type: dto.type,
      discount: dto.discount,
      date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
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
      visit:
        dto.visitId === undefined
          ? undefined
          : dto.visitId
            ? { connect: { id: dto.visitId } }
            : { disconnect: true },
    });
    return this.toResponse(p);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.paymentsRepository.delete(id);
    return { id };
  }

  async getStats() {
    const now = new Date();
    const today = startOfUTCDay(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    const [totalRevenue, pendingAmount, todayRevenue] = await Promise.all([
      this.paymentsRepository.sumAmount({ status: 'paid' }),
      this.paymentsRepository.sumAmount({
        status: { in: ['partial', 'unpaid'] },
      }),
      this.paymentsRepository.sumAmount({
        status: 'paid',
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

  private toResponse(p: Payment) {
    return {
      id: p.id,
      patientId: p.patientId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: toDateOnlyString(p.date),
      description: p.description,
      type: p.type,
      discount: p.discount ?? undefined,
      serviceId: p.serviceId ?? undefined,
      visitId: p.visitId ?? undefined,
    };
  }
}
