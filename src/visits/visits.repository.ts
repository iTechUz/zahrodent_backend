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
        orderBy: opts?.orderBy ?? [{ date: 'desc' }, { id: 'desc' }],
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { data, total };
  }

  /** Is the patient (non-deleted) inside the given scope filter? */
  async patientInScope(
    patientId: string,
    scope: Prisma.PatientWhereInput,
  ): Promise<boolean> {
    const n = await this.prisma.patient.count({
      where: { AND: [{ id: patientId, deletedAt: null }, scope] },
    });
    return n > 0;
  }

  findBookingOwner(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, patientId: true, doctorId: true },
    });
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
