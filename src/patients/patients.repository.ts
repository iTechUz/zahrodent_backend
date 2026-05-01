import { Injectable } from '@nestjs/common';
import { Patient, Prisma, PatientComment } from '@prisma/client';
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
        where: { ...where, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          branch: true,
        },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.patient.count({ where: { ...where, deletedAt: null } }),
    ]);
    return { data, total };
  }

  count(where?: Prisma.PatientWhereInput): Promise<number> {
    return this.prisma.patient.count({ where: { ...where, deletedAt: null } });
  }

  findById(id: string) {
    return this.prisma.patient.findUnique({
      where: { id },
      include: {
        user: true,
        branch: true,
        assignedDoctor: { include: { user: true } },
      },
    });
  }

  create(data: Prisma.PatientCreateInput): Promise<Patient> {
    return this.prisma.patient.create({ data });
  }

  update(id: string, data: Prisma.PatientUpdateInput): Promise<Patient> {
    return this.prisma.patient.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Patient> {
    return this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(where?: Prisma.PatientWhereInput) {
    const total = await this.prisma.patient.count({
      where: { ...where, deletedAt: null },
    });

    const activeThisMonth = await this.prisma.patient.count({
      where: {
        ...where,
        deletedAt: null,
        bookings: {
          some: {
            startTime: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
      },
    });

    return { total, activeThisMonth };
  }

  createComment(data: Prisma.PatientCommentUncheckedCreateInput): Promise<PatientComment> {
    return this.prisma.patientComment.create({ data });
  }

  findCommentsByPatientId(patientId: string): Promise<any[]> {
    return this.prisma.patientComment.findMany({
      where: { patientId },
      include: { author: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSourcesByPatientIds(ids: string[]) {
    return this.prisma.patient.findMany({
      where: { id: { in: ids } },
      select: { id: true, source: true },
    });
  }

  async findPhonesByPatientIds(ids: string[]) {
    return this.prisma.patient.findMany({
      where: { id: { in: ids } },
      select: { id: true, phone: true },
    });
  }
}
