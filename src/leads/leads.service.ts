import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto, LEAD_LANGS } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Lead, Prisma } from '@prisma/client';
import { ClientNotifierService } from '../notifications/client-notifier.service';
import { NotificationLogService } from '../notifications/notification-log.service';
import { normalizeUzPhone } from '../common/utils/phone.util';
import { LeadsQueryDto } from './dto/leads-query.dto';
import { orderByOption } from '../common/dto/pagination.dto';
import {
  parseDateOnlyToUTC,
  tashkentInstantRange,
  todayInTashkent,
} from '../common/utils/date.util';
import { leadsChatId } from '../telegram/dev-defaults';

/** Sources announced in the staff group (CRM-entered leads are not). */
const NOTIFIED_SOURCES = ['website', 'telegram_bot'];

/** Public/bot leads with the same phone inside this window are one lead. */
export const LEAD_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const SOURCE_LABELS: Record<string, string> = {
  website: 'Sayt',
  telegram_bot: 'Telegram bot',
};

/** Merged "message" never grows past this (bot caps one message at 2000). */
export const LEAD_MESSAGE_MAX = 2000;

/**
 * Visitor-typed links must not become clickable in the staff group:
 * "https://x.y" → "https[:]//x[.]y", "www.x" and bare "site.com" get a bracketed dot.
 */
export function neutralizeLinks(v: string): string {
  return v
    .replace(/:\/\//g, '[:]//')
    .replace(/\bwww\./gi, 'www[.]')
    .replace(/\b([\p{L}\d-]+(?:\.[\p{L}\d-]+)*)\.(\p{L}{2,})\b/gu, '$1[.]$2');
}

/** One line, no control chars, no @-mentions, no live links, length-capped (plain text only). */
function clean(v: string | null | undefined, max: number): string {
  const t = neutralizeLinks(
    (v ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, ' '),
  )
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

/** Link to the lead in the admin panel — only when ADMIN_PUBLIC_URL is set. */
export function adminLeadLink(phone: string): string | null {
  const base = process.env.ADMIN_PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return `${base}/leads?search=${encodeURIComponent(phone)}`;
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
  if (lead.lang && LEAD_LANGS.includes(lead.lang as 'uz'))
    lines.push(`🌐 ${lead.lang.toUpperCase()}`);
  if (lead.doctor) lines.push(`👨‍⚕️ ${clean(lead.doctor, 100)}`);
  if (lead.preferredAt) lines.push(`📅 ${clean(lead.preferredAt, 30)}`);
  if (lead.service) lines.push(`🦷 ${clean(lead.service, 100)}`);
  if (lead.message) lines.push(`💬 ${clean(lead.message, 500)}`);
  lines.push(
    `📍 ${SOURCE_LABELS[lead.source] ?? clean(lead.source, 40)}`,
    `🕒 ${tashkentTime(lead.createdAt ?? new Date())} (Toshkent)`,
  );
  const link = adminLeadLink(lead.phone);
  if (link) lines.push(`🔗 ${link}`);
  return lines.join('\n');
}

/** Staff note: the same person sent a repeat request with new details. */
export function formatLeadUpdateMessage(lead: Lead, added: string): string {
  const lines = [
    "➕ Qo'shimcha ma'lumot (mavjud murojaat)",
    `👤 ${clean(lead.name, 100)}`,
    `📞 ${clean(lead.phone, 30)}`,
    `💬 ${clean(added, 500)}`,
  ];
  const link = adminLeadLink(lead.phone);
  if (link) lines.push(`🔗 ${link}`);
  return lines.join('\n');
}

type NewDetails = Pick<
  CreateLeadDto,
  'service' | 'doctor' | 'preferredAt' | 'message' | 'lang'
> & { telegramChatId?: string };

/**
 * Repeat request inside the dedupe window: keeps the old text and appends a
 * dated line with whatever is new. `added` is null when nothing new came in.
 */
export function mergeLeadDetails(
  existing: Lead,
  d: NewDetails,
  now: Date = new Date(),
): { patch: Prisma.LeadUpdateInput | null; added: string | null } {
  const patch: Prisma.LeadUpdateInput = {};
  const parts: string[] = [];
  const t = (v?: string | null) => v?.replace(/\s+/g, ' ').trim() ?? '';
  const service = t(d.service);
  if (service && service !== existing.service) {
    parts.push(`Xizmat: ${service}`);
    if (!existing.service) patch.service = service;
  }
  const doctor = t(d.doctor);
  if (doctor && doctor !== existing.doctor) {
    parts.push(`Shifokor: ${doctor}`);
    if (!existing.doctor) patch.doctor = doctor;
  }
  const at = t(d.preferredAt);
  if (at && at !== existing.preferredAt) {
    parts.push(`Vaqt: ${at}`);
    if (!existing.preferredAt) patch.preferredAt = at;
  }
  const msg = t(d.message);
  if (msg && !(existing.message ?? '').replace(/\s+/g, ' ').includes(msg)) {
    parts.push(`Xabar: ${msg}`);
  }
  if (!existing.telegramChatId && d.telegramChatId) {
    patch.telegramChatId = d.telegramChatId;
  }
  if (!existing.lang && d.lang) patch.lang = d.lang;

  const added = parts.length ? parts.join('; ') : null;
  if (added) {
    const line = `[${tashkentTime(now)}] ${added}`;
    const base = existing.message ?? '';
    const room = LEAD_MESSAGE_MAX - base.length - (base ? 1 : 0);
    if (room >= 20) {
      const fit = line.length > room ? `${line.slice(0, room - 1)}…` : line;
      patch.message = base ? `${base}\n${fit}` : fit;
    }
  }
  return { patch: Object.keys(patch).length ? patch : null, added };
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly outbox: NotificationLogService,
    private readonly clientNotifier: ClientNotifierService,
  ) {}

  /**
   * `telegramChatId` is set only by the bot, and only for the person's OWN
   * contact (it is not part of the validated DTO, so the HTTP API cannot set it).
   */
  async create(dto: CreateLeadDto & { telegramChatId?: string }) {
    // Canonical +998XXXXXXXXX when it is an Uzbek number (CRM may hold others).
    const phone = normalizeUzPhone(dto.phone) ?? dto.phone.trim();
    const automated = NOTIFIED_SOURCES.includes(dto.source ?? '');
    let lead: Lead;
    if (automated) {
      // Check-then-insert under a per-phone lock: a double-click can't make two leads.
      let added: string | null = null;
      const r = await this.leadsRepository.createOrMerge(
        phone,
        new Date(Date.now() - LEAD_DEDUPE_WINDOW_MS),
        { ...dto, phone } as Prisma.LeadCreateInput,
        (existing) => {
          const m = mergeLeadDetails(existing, dto);
          added = m.added;
          return m.patch;
        },
      );
      lead = r.lead;
      if (!r.created) {
        // Same person re-submitting: one lead; new details are appended and staff get a short note.
        if (added) void this.notifyLeadUpdate(lead, added);
        return lead;
      }
    } else {
      lead = await this.leadsRepository.create({
        ...dto,
        phone,
      } as Prisma.LeadCreateInput);
    }
    this.notificationsGateway.sendNewLead(lead);
    // Fire-and-forget: a Telegram problem must never fail lead creation.
    void this.notifyLeadsChat(lead);
    // Website visitors have no bot chat yet: Telegram if linked, else SMS + deep link.
    if (lead.source === 'website')
      void this.clientNotifier.notifyLeadReceived(lead);
    return lead;
  }

  private async notifyLeadUpdate(lead: Lead, added: string): Promise<void> {
    try {
      const chatId = leadsChatId();
      if (!chatId) return;
      await this.outbox.enqueue({
        kind: 'lead_group_update',
        chatId,
        text: formatLeadUpdateMessage(lead, added),
        leadId: lead.id,
      });
    } catch (e) {
      this.logger.warn(
        `Lead qo'shimcha ma'lumoti guruhga yuborilmadi: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Queues a new website/bot lead for TELEGRAM_LEADS_CHAT_ID (off when unset).
   * The outbox logs the attempt and retries on Telegram failures.
   */
  private async notifyLeadsChat(lead: Lead): Promise<void> {
    try {
      const chatId = leadsChatId();
      if (!chatId || !NOTIFIED_SOURCES.includes(lead.source)) return;
      await this.outbox.enqueue({
        kind: 'lead_group',
        chatId,
        text: formatLeadMessage(lead),
        leadId: lead.id,
      });
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
    // Same canonical phone as on create.
    const data: UpdateLeadDto = { ...dto };
    if (dto.phone !== undefined) {
      data.phone = normalizeUzPhone(dto.phone) ?? dto.phone.trim();
    }
    // First move to "converted" → the lead becomes a patient automatically
    // (the repository re-checks inside a transaction: concurrent-safe).
    if (data.status === 'converted' && lead.status !== 'converted') {
      const converted = await this.leadsRepository.updateAndEnsurePatient(
        id,
        data,
        {
          name: data.name ?? lead.name,
          phone: data.phone ?? lead.phone,
          source: lead.source,
          service: data.service ?? lead.service,
          message: data.message ?? lead.message,
          telegramChatId: lead.telegramChatId,
        },
        parseDateOnlyToUTC(todayInTashkent()),
      );
      void this.clientNotifier.notifyLeadStatus(converted, 'converted');
      return converted;
    }
    const updated = await this.leadsRepository.update(id, data);
    // Tell the person (if they linked the bot) — fire-and-forget, never fails the update.
    if (data.status && data.status !== lead.status) {
      void this.clientNotifier.notifyLeadStatus(updated, data.status);
    }
    return updated;
  }

  async remove(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException('Murojaat topilmadi');
    await this.leadsRepository.delete(id);
    return { success: true };
  }
}
