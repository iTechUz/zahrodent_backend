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
        include: {
          patient: true,
          service: true,
          visit: true,
        },
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
    return result._sum.amount?.toNumber() || 0;
  }

  async getDoctorStats(): Promise<{ doctorId: string; total: number }[]> {
    const result = await this.prisma.payment.groupBy({
      by: ['visitId'],
      where: { status: 'COMPLETED', visitId: { not: null } },
      _sum: { amount: true },
    });

    const visitIds = result.map((r) => r.visitId).filter(Boolean) as string[];
    const visits = await this.prisma.visit.findMany({
      where: { id: { in: visitIds } },
      select: { id: true, doctorId: true },
    });

    const visitDoctorMap = new Map(visits.map((v) => [v.id, v.doctorId]));

    const doctorTotals = new Map<string, number>();
    for (const row of result) {
      if (!row.visitId) continue;
      const doctorId = visitDoctorMap.get(row.visitId);
      if (!doctorId) continue;
      doctorTotals.set(
        doctorId,
        (doctorTotals.get(doctorId) ?? 0) + (row._sum.amount?.toNumber() ?? 0),
      );
    }

    return Array.from(doctorTotals.entries()).map(([doctorId, total]) => ({
      doctorId,
      total,
    }));
  }

  findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        patient: true,
        service: true,
        visit: true,
      },
    });
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
