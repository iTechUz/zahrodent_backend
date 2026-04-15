import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.DoctorWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Doctor[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        orderBy: { name: 'asc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.doctor.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<Doctor | null> {
    return this.prisma.doctor.findUnique({ where: { id } });
  }

  create(data: Prisma.DoctorCreateInput): Promise<Doctor> {
    return this.prisma.doctor.create({ data });
  }

  update(id: string, data: Prisma.DoctorUpdateInput): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data });
  }

  delete(id: string): Promise<Doctor> {
    return this.prisma.doctor.delete({ where: { id } });
  }
}
