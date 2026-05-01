import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PaymentWhereInput;
  }): Promise<{ data: Payment[]; total: number }> {
    const { skip, take, where } = params;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        skip,
        take,
        where,
        orderBy: { date: 'desc' },
        include: {
          patient: true,
          doctor: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
      },
    });
  }

  async sumAmount(where: Prisma.PaymentWhereInput): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where,
    });
    return result._sum.amount?.toNumber() || 0;
  }

  async getDoctorStats() {
    const stats = await this.prisma.payment.groupBy({
      by: ['doctorId'],
      _sum: {
        amount: true,
      },
      where: {
        status: 'INCOME',
        doctorId: { not: null },
      },
    });

    return stats.map((row) => ({
      doctorId: row.doctorId as string,
      total: row._sum.amount?.toNumber() || 0,
    }));
  }

  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  async update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Payment> {
    return this.prisma.payment.delete({ where: { id } });
  }
}
