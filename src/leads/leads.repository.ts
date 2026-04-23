import { Injectable } from '@nestjs/common';
import { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(where?: Prisma.LeadWhereInput): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Lead | null> {
    return this.prisma.lead.findUnique({ where: { id } });
  }

  async create(data: Prisma.LeadCreateInput): Promise<Lead> {
    return this.prisma.lead.create({ data });
  }

  async update(id: string, data: Prisma.LeadUpdateInput): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Lead> {
    return this.prisma.lead.delete({ where: { id } });
  }
}
