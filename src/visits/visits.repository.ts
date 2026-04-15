import { Injectable } from '@nestjs/common';
import { Prisma, Visit } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    where?: Prisma.VisitWhereInput,
    opts?: { skip?: number; take?: number },
  ): Promise<{ data: Visit[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: { date: 'desc' },
        ...(opts?.skip != null ? { skip: opts.skip } : {}),
        ...(opts?.take != null ? { take: opts.take } : {}),
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<Visit | null> {
    return this.prisma.visit.findUnique({ where: { id } });
  }

  create(data: Prisma.VisitCreateInput): Promise<Visit> {
    return this.prisma.visit.create({ data });
  }

  update(id: string, data: Prisma.VisitUpdateInput): Promise<Visit> {
    return this.prisma.visit.update({ where: { id }, data });
  }
}
