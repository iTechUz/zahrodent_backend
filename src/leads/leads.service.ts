import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Lead, Prisma } from '@prisma/client';
import { TelegramBotRegistry } from '../telegram/telegram-bot.registry';
import { LeadsQueryDto } from './dto/leads-query.dto';
import { orderByOption } from '../common/dto/pagination.dto';
import {
  parseDateOnlyToUTC,
  tashkentInstantRange,
  todayInTashkent,
} from '../common/utils/date.util';

/** Sources announced in the staff group (CRM-entered leads are not). */
const NOTIFIED_SOURCES = ['website', 'telegram_bot'];

const SOURCE_LABELS: Record<string, string> = {
  website: 'Sayt',
  telegram_bot: 'Telegram bot',
};

/** One line, no control chars, no @-mentions, length-capped (plain text only). */
function clean(v: string | null | undefined, max: number): string {
  const t = (v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/@/g, '@\u200b')
    .trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function tashkentTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(/\//g, '.')
    .replace(',', '');
}

/**
 * Plain text on purpose (no parse_mode): visitor input can't inject
 * markup/links through Telegram's HTML/Markdown parsers.
 */
export function formatLeadMessage(lead: Lead): string {
  const lines = [
    '🆕 Yangi murojaat',
    `👤 ${clean(lead.name, 100)}`,
    `📞 ${clean(lead.phone, 30)}`,
  ];
  if (lead.service) lines.push(`🦷 ${clean(lead.service, 100)}`);
  if (lead.message) lines.push(`💬 ${clean(lead.message, 500)}`);
  lines.push(
    `📍 ${SOURCE_LABELS[lead.source] ?? clean(lead.source, 40)}`,
    `🕒 ${tashkentTime(lead.createdAt ?? new Date())} (Toshkent)`,
  );
  return lines.join('\n');
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly telegram: TelegramBotRegistry,
  ) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.leadsRepository.create(
      dto as Prisma.LeadCreateInput,
    );
    this.notificationsGateway.sendNewLead(lead);
    // Fire-and-forget: a Telegram problem must never fail lead creation.
    void this.notifyLeadsChat(lead);
    return lead;
  }

  /** Posts a new website/bot lead to TELEGRAM_LEADS_CHAT_ID (off when unset). */
  private async notifyLeadsChat(lead: Lead): Promise<void> {
    try {
      const chatId = process.env.TELEGRAM_LEADS_CHAT_ID?.trim();
      if (!chatId || !NOTIFIED_SOURCES.includes(lead.source)) return;
      const res = await this.telegram.sendMessage(
        chatId,
        formatLeadMessage(lead),
      );
      if (res.ok === false) {
        this.logger.warn(`Lead Telegram guruhiga yuborilmadi: ${res.error}`);
      }
    } catch (e) {
      this.logger.warn(
        `Lead Telegram guruhiga yuborilmadi: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async findAll(query: LeadsQueryDto) {
    const { search, startDate, endDate, status, source } = query;
    const pageNum = Number(query.page || 0);
    const take = Number(query.limit || 10);
    const skip = pageNum * take;

    const where: Prisma.LeadWhereInput = {};

    const s = search?.trim();
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ];
    }

    if (status && status !== 'all') where.status = status;
    if (source) where.source = source;

    if (startDate || endDate) {
      // created_at is a timestamp → whole Asia/Tashkent days.
      where.createdAt = tashkentInstantRange(startDate, endDate);
    }

    return this.leadsRepository.findAll({
      skip,
      take,
      where,
      ...orderByOption<Prisma.LeadOrderByWithRelationInput[]>(
        query,
        'createdAt',
      ),
    });
  }

  async findOne(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    // First move to "converted" → the lead becomes a patient automatically.
    if (dto.status === 'converted' && lead.status !== 'converted') {
      return this.leadsRepository.updateAndEnsurePatient(
        id,
        dto,
        { ...lead, ...dto },
        parseDateOnlyToUTC(todayInTashkent()),
      );
    }
    return this.leadsRepository.update(id, dto);
  }

  async remove(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
