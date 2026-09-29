import { Injectable } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { debtorBalancesSql, PATIENT_BALANCE_INCLUDE } from './patient-balance';

const PATIENT_INCLUDE = {
  ...PATIENT_BALANCE_INCLUDE,
  assignedDoctor: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.PatientInclude;

export type PatientWithRelations = Prisma.PatientGetPayload<{
  include: typeof PATIENT_INCLUDE;
}>;

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.PatientWhereInput,
    opts?: {
      skip?: number;
      take?: number;
      orderBy?:
        | Prisma.PatientOrderByWithRelationInput
        | Prisma.PatientOrderByWithRelationInput[];
    },
  ): Promise<{ data: PatientWithRelations[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: PATIENT_INCLUDE,
        orderBy: opts?.orderBy ?? { createdAt: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.PatientWhereInput): Promise<number> {
    return this.prisma.patient.count({ where });
  }

  groupBySource(where?: Prisma.PatientWhereInput) {
    return this.prisma.patient.groupBy({
      by: ['source'],
      where,
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
      take: 1,
    });
  }

  /** Patients with a negative balance (see patient-balance.ts). */
  findDebtors(): Promise<{ id: string; balance: number }[]> {
    return this.prisma.$queryRaw<{ id: string; balance: number }[]>(
      debtorBalancesSql,
    );
  }

  /** Visits + payments count — a patient with history must not be deleted. */
  async countHistory(
    id: string,
  ): Promise<{ visits: number; payments: number }> {
    const [visits, payments] = await Promise.all([
      this.prisma.visit.count({ where: { patientId: id } }),
      this.prisma.payment.count({ where: { patientId: id } }),
    ]);
    return { visits, payments };
  }

  findById(id: string): Promise<PatientWithRelations | null> {
    return this.prisma.patient.findUnique({
      where: { id },
      include: PATIENT_INCLUDE,
    });
  }

  findSourcesByPatientIds(ids: string[]) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) {
      return Promise.resolve([] as { id: string; source: string }[]);
    }
    return this.prisma.patient.findMany({
      where: { id: { in: unique } },
      select: { id: true, source: true },
    });
  }

  findPhonesByPatientIds(ids: string[]) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) {
      return Promise.resolve([] as { id: string; phone: string }[]);
    }
    return this.prisma.patient.findMany({
      where: { id: { in: unique } },
      select: { id: true, phone: true },
    });
  }

  create(data: Prisma.PatientCreateInput): Promise<PatientWithRelations> {
    return this.prisma.patient.create({ data, include: PATIENT_INCLUDE });
  }

  update(
    id: string,
    data: Prisma.PatientUpdateInput,
  ): Promise<PatientWithRelations> {
    return this.prisma.patient.update({
      where: { id },
      data,
      include: PATIENT_INCLUDE,
    });
  }

  delete(id: string): Promise<Patient> {
    return this.prisma.patient.delete({ where: { id } });
  }

  // Comments
  async createComment(data: {
    content: string;
    patientId: string;
    authorId: string;
  }) {
    return this.prisma.patientComment.create({
      data,
      include: { author: { select: { name: true, avatar: true } } },
    });
  }

  async findCommentsByPatientId(patientId: string) {
    return this.prisma.patientComment.findMany({
      where: { patientId },
      include: { author: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
