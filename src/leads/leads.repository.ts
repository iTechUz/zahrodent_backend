import { Injectable } from '@nestjs/common';
import { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.LeadWhereInput;
    orderBy?: Prisma.LeadOrderByWithRelationInput[];
  }): Promise<{ data: Lead[]; total: number }> {
    const { skip, take, where, orderBy } = params;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        skip,
        take,
        where,
        orderBy: orderBy ?? { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Lead | null> {
    return this.prisma.lead.findUnique({ where: { id } });
  }

  async create(data: Prisma.LeadCreateInput): Promise<Lead> {
    return this.prisma.lead.create({ data });
  }

  /** Newest still-open lead with this phone created at/after `since`. */
  async findOpenByPhoneSince(phone: string, since: Date): Promise<Lead | null> {
    return this.prisma.lead.findFirst({
      where: {
        phone,
        createdAt: { gte: since },
        status: { notIn: ['converted', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
    });
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

  /**
   * Updates the lead and, in the same transaction, makes sure a patient with
   * the lead's phone exists (reuses a live one instead of duplicating).
   */
  async updateAndEnsurePatient(
    id: string,
    data: Prisma.LeadUpdateInput,
    lead: Pick<Lead, 'name' | 'phone' | 'source' | 'service' | 'message'>,
    patientDate: Date,
  ): Promise<Lead> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id }, data });
      const existing = await tx.patient.findFirst({
        where: { phone: lead.phone, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        const [firstName, ...rest] = lead.name.trim().split(/\s+/);
        const notes = [
          lead.service && `Xizmat: ${lead.service}`,
          lead.message && `Murojaat: ${lead.message}`,
        ]
          .filter(Boolean)
          .join('\n');
        await tx.patient.create({
          data: {
            firstName: firstName || lead.name,
            lastName: rest.join(' '),
            // Unknown at lead stage; the schema requires a value.
            age: 0,
            phone: lead.phone,
            source: patientSourceFromLead(lead.source),
            notes,
            createdAt: patientDate,
          },
        });
      }
      return updated;
    });
  }
}

function patientSourceFromLead(source: string): string {
  if (source === 'telegram_bot') return 'telegram';
  if (source === 'website') return 'website';
  return 'phone';
}
