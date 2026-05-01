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
        where: { ...where, deletedAt: null },
        include: {
          payments: true,
          visits: true,
          assignedDoctor: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
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

  groupBySource() {
    return this.prisma.patient.groupBy({
      by: ['source'],
      where: { deletedAt: null },
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
      take: 1,
    });
  }

  findById(id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({
      where: { id },
      include: {
        payments: true,
        visits: true,
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
