import { Injectable } from '@nestjs/common';
import { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { normalizeUzPhone } from '../common/utils/phone.util';

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

  /**
   * Atomic "one open lead per phone in the window": under a per-phone advisory
   * lock either creates the lead, or (when a recent open lead exists) lets
   * `merge` turn the new details into an update of that lead. A double-click
   * or two parallel requests therefore never make two leads / two staff pings.
   * `merge` returns null when there is nothing to write.
   */
  async createOrMerge(
    phone: string,
    since: Date,
    data: Prisma.LeadCreateInput,
    merge: (existing: Lead) => Prisma.LeadUpdateInput | null,
  ): Promise<{ lead: Lead; created: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
      const dup = await tx.lead.findFirst({
        where: {
          phone,
          createdAt: { gte: since },
          status: { notIn: ['converted', 'cancelled'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!dup) return { lead: await tx.lead.create({ data }), created: true };
      const patch = merge(dup);
      const lead = patch
        ? await tx.lead.update({ where: { id: dup.id }, data: patch })
        : dup;
      return { lead, created: false };
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
    lead: Pick<Lead, 'name' | 'phone' | 'source' | 'service' | 'message'> & {
      telegramChatId?: string | null;
    },
    patientDate: Date,
  ): Promise<Lead> {
    return this.prisma.$transaction(async (tx) => {
      // Serialise conversions of the same phone (two leads / two clicks).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lead.phone}))`;
      // Claim the transition: only the request that really flips the status
      // creates the patient; a concurrent twin just returns the lead.
      const claimed = await tx.lead.updateMany({
        where: { id, status: { not: 'converted' } },
        data: data as Prisma.LeadUpdateManyMutationInput,
      });
      const updated = await tx.lead.findUniqueOrThrow({ where: { id } });
      if (claimed.count === 0) return updated;
      const canonical = normalizeUzPhone(lead.phone);
      // Same digit-based match as the bot/linking code (any phone formatting in the DB).
      const digits = (canonical ?? lead.phone).replace(/\D/g, '');
      const matches = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM patients
        WHERE deleted_at IS NULL
          AND regexp_replace(phone, '[^0-9]', '', 'g') IN (${digits}, ${digits.slice(-9)})
      `;
      const chat = lead.telegramChatId;
      if (matches.length === 0) {
        // "Ali Valiyev" → Ali / Valiyev; a single word is the first name.
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
            // Unknown at lead stage: birthYear stays NULL; `age` is NOT NULL
            // in the schema, so 0 is the "unknown" placeholder.
            age: 0,
            birthYear: null,
            workplace: '',
            phone: canonical ?? lead.phone,
            source: patientSourceFromLead(lead.source),
            notes,
            // Reminders reach the person right away (status text promises it).
            telegramChatId: chat ?? null,
            createdAt: patientDate,
          },
        });
      } else if (chat) {
        // Matched card(s) without a chat get the lead's own-contact chat.
        await tx.patient.updateMany({
          where: { id: { in: matches.map((m) => m.id) }, telegramChatId: null },
          data: { telegramChatId: chat },
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
