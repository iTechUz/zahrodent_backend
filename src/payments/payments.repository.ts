import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { debtSummarySql } from '../patients/patient-balance';
import {
  PatientSummaryRow,
  WITH_PATIENT_SUMMARY,
} from '../patients/patient-summary';

export type PaymentActor = { id: string | null; name: string };

/** JSON snapshot of a payment row for the audit trail (Dates → ISO strings). */
export function paymentSnapshot(p: Payment): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(p)) as Prisma.InputJsonValue;
}

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
        orderBy: opts?.orderBy ?? [{ date: 'desc' }, { id: 'desc' }],
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
      select: { id: true, patientId: true, price: true },
    });
  }

  /** `range` limits payments by their date (inclusive); omitted → all time. */
  async getDoctorStats(range?: {
    gte?: Date;
    lte?: Date;
  }): Promise<{ doctorId: string; total: number }[]> {
    const result = await this.prisma.payment.groupBy({
      by: ['visitId'],
      where: {
        type: 'INCOME',
        status: { in: ['paid', 'partial'] },
        visitId: { not: null },
        ...(range && (range.gte || range.lte) ? { date: range } : {}),
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

  private auditRow(
    action: 'create' | 'update' | 'delete',
    paymentId: string,
    actor: PaymentActor,
    before: Payment | null,
    after: Payment | null,
  ): Prisma.PaymentAuditUncheckedCreateInput {
    return {
      paymentId,
      action,
      actorId: actor.id,
      actorName: actor.name.slice(0, 100),
      before: before ? paymentSnapshot(before) : undefined,
      after: after ? paymentSnapshot(after) : undefined,
    };
  }

  /** Payment + its audit row in ONE transaction. */
  createWithAudit(
    data: Prisma.PaymentCreateInput,
    actor: PaymentActor,
  ): Promise<PaymentWithPatient> {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { ...data, createdById: actor.id },
        include: WITH_PATIENT_SUMMARY,
      });
      await tx.paymentAudit.create({
        data: this.auditRow('create', p.id, actor, null, p),
      });
      return p;
    });
  }

  /** The "before" snapshot is read inside the transaction (fresh). */
  updateWithAudit(
    id: string,
    data: Prisma.PaymentUpdateInput,
    actor: PaymentActor,
  ): Promise<PaymentWithPatient> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.payment.findUnique({ where: { id } });
      const p = await tx.payment.update({
        where: { id },
        data,
        include: WITH_PATIENT_SUMMARY,
      });
      await tx.paymentAudit.create({
        data: this.auditRow('update', id, actor, before, p),
      });
      return p;
    });
  }

  /** Hard delete; the full row is snapshotted into the audit first. */
  deleteWithAudit(id: string, actor: PaymentActor): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.payment.findUnique({ where: { id } });
      await tx.paymentAudit.create({
        data: this.auditRow('delete', id, actor, before, null),
      });
      return tx.payment.delete({ where: { id } });
    });
  }

  listAudit(paymentId: string) {
    return this.prisma.paymentAudit.findMany({
      where: { paymentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }
}
