import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.PaymentWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Payment[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { date: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total };
  }

  async sumAmount(where: Prisma.PaymentWhereInput): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  }

  findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({ where: { id }, data });
  }

  delete(id: string): Promise<Payment> {
    return this.prisma.payment.delete({ where: { id } });
  }
}
