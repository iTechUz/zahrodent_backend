import { Injectable } from '@nestjs/common';
import { Prisma, Visit } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(where?: Prisma.VisitWhereInput): Promise<Visit[]> {
    return this.prisma.visit.findMany({
      where,
      orderBy: { date: 'desc' },
    });
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
