import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const PRESCRIPTION_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  patient: {
    select: { firstName: true, lastName: true, age: true, deletedAt: true },
  },
  doctor: { select: { firstName: true, lastName: true, specialty: true } },
} satisfies Prisma.PrescriptionInclude;

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{
  include: typeof PRESCRIPTION_INCLUDE;
}>;

@Injectable()
export class PrescriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where: Prisma.PrescriptionWhereInput,
    opts: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.PrescriptionOrderByWithRelationInput[];
    },
  ): Promise<{ data: PrescriptionRow[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        include: PRESCRIPTION_INCLUDE,
        orderBy: opts.orderBy ?? { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.prescription.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<PrescriptionRow | null> {
    return this.prisma.prescription.findUnique({
      where: { id },
      include: PRESCRIPTION_INCLUDE,
    });
  }

  create(data: Prisma.PrescriptionCreateInput): Promise<PrescriptionRow> {
    return this.prisma.prescription.create({
      data,
      include: PRESCRIPTION_INCLUDE,
    });
  }

  /**
   * Atomic status transition: only touches the row while it is still in
   * `from` (and, optionally, not expired) so two pharmacies can't both
   * dispense the same prescription. Returns the number of rows changed.
   */
  async transition(
    id: string,
    from: string,
    data: Prisma.PrescriptionUpdateManyMutationInput,
    notExpiredOn?: Date,
  ): Promise<number> {
    const res = await this.prisma.prescription.updateMany({
      where: {
        id,
        status: from,
        ...(notExpiredOn ? { validUntil: { gte: notExpiredOn } } : {}),
      },
      data,
    });
    return res.count;
  }

  countPatients(where: Prisma.PatientWhereInput): Promise<number> {
    return this.prisma.patient.count({ where });
  }

  countVisits(where: Prisma.VisitWhereInput): Promise<number> {
    return this.prisma.visit.count({ where });
  }
}
