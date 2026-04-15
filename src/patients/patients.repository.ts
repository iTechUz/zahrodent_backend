import { Injectable } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.PatientWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Patient[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({ where: { id } });
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

  create(data: Prisma.PatientCreateInput): Promise<Patient> {
    return this.prisma.patient.create({ data });
  }

  update(id: string, data: Prisma.PatientUpdateInput): Promise<Patient> {
    return this.prisma.patient.update({ where: { id }, data });
  }

  delete(id: string): Promise<Patient> {
    return this.prisma.patient.delete({ where: { id } });
  }
}
