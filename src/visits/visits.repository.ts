import { Injectable } from '@nestjs/common';
import { Prisma, Visit } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PatientSummaryRow,
  WITH_PATIENT_SUMMARY,
} from '../patients/patient-summary';

export type VisitWithPatient = Visit & { patient?: PatientSummaryRow | null };

@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.VisitWhereInput,
    opts?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.VisitOrderByWithRelationInput[];
    },
  ): Promise<{ data: VisitWithPatient[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: WITH_PATIENT_SUMMARY,
        orderBy: opts?.orderBy ?? { date: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<VisitWithPatient | null> {
    return this.prisma.visit.findUnique({
      where: { id },
      include: WITH_PATIENT_SUMMARY,
    });
  }

  create(data: Prisma.VisitCreateInput): Promise<VisitWithPatient> {
    return this.prisma.visit.create({ data, include: WITH_PATIENT_SUMMARY });
  }

  update(id: string, data: Prisma.VisitUpdateInput): Promise<VisitWithPatient> {
    return this.prisma.visit.update({
      where: { id },
      data,
      include: WITH_PATIENT_SUMMARY,
    });
  }
}
