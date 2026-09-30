import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { debtSummarySql } from '../patients/patient-balance';
import {
  PatientSummaryRow,
  WITH_PATIENT_SUMMARY,
} from '../patients/patient-summary';

export type PaymentWithPatient = Payment & {
  patient?: PatientSummaryRow | null;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.PaymentWhereInput,
    opts?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.PaymentOrderByWithRelationInput[];
    },
  ): Promise<{ data: PaymentWithPatient[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: WITH_PATIENT_SUMMARY,
        orderBy: opts?.orderBy ?? { date: 'desc' },
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

  /** Outstanding patient debt — see patients/patient-balance.ts. */
  async getDebtSummary(): Promise<{ total: number; count: number }> {
    const rows =
      await this.prisma.$queryRaw<{ total: number; count: number }[]>(
        debtSummarySql,
      );
    return {
      total: Number(rows[0]?.total ?? 0),
      count: Number(rows[0]?.count ?? 0),
    };
  }

  findVisitOwner(visitId: string) {
    return this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, patientId: true },
    });
  }

  async getDoctorStats(): Promise<{ doctorId: string; total: number }[]> {
    const result = await this.prisma.payment.groupBy({
      by: ['visitId'],
      where: {
        type: 'INCOME',
        status: { in: ['paid', 'partial'] },
        visitId: { not: null },
      },
      _sum: { amount: true },
    });

    // Map visitId → doctorId via visits table
    const visitIds = result.map((r) => r.visitId).filter(Boolean) as string[];
    const visits = await this.prisma.visit.findMany({
      where: { id: { in: visitIds } },
      select: { id: true, doctorId: true },
    });

    const visitDoctorMap = new Map(visits.map((v) => [v.id, v.doctorId]));

    // Aggregate by doctorId
    const doctorTotals = new Map<string, number>();
    for (const row of result) {
      if (!row.visitId) continue;
      const doctorId = visitDoctorMap.get(row.visitId);
      if (!doctorId) continue;
      doctorTotals.set(
        doctorId,
        (doctorTotals.get(doctorId) ?? 0) + (row._sum.amount ?? 0),
      );
    }

    return Array.from(doctorTotals.entries()).map(([doctorId, total]) => ({
      doctorId,
      total,
    }));
  }

  findById(id: string): Promise<PaymentWithPatient | null> {
    return this.prisma.payment.findUnique({
      where: { id },
      include: WITH_PATIENT_SUMMARY,
    });
  }

  create(data: Prisma.PaymentCreateInput): Promise<PaymentWithPatient> {
    return this.prisma.payment.create({ data, include: WITH_PATIENT_SUMMARY });
  }

  update(
    id: string,
    data: Prisma.PaymentUpdateInput,
  ): Promise<PaymentWithPatient> {
    return this.prisma.payment.update({
      where: { id },
      data,
      include: WITH_PATIENT_SUMMARY,
    });
  }

  delete(id: string): Promise<Payment> {
    return this.prisma.payment.delete({ where: { id } });
  }
}
