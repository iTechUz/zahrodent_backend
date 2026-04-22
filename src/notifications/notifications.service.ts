import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PrismaService } from '../database/prisma.service';
import { startOfUTCDay, toDateOnlyString } from '../common/utils/date.util';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { RecipientQueryDto, BulkSendDto } from './dto/bulk-sms.dto';

type ReminderType = 'sms' | 'telegram';
type ReminderStatus = 'sent' | 'failed';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly eskiz: EskizService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<any>> {
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const { data, total } = await this.notificationsRepository.findAll({
      skip,
      take: limitNum,
    });
    return { data: data.map((n) => this.toResponse(n)), total };
  }

  async create(dto: CreateNotificationDto) {
    const sentAt = dto.sentAt ? new Date(dto.sentAt) : new Date();
    let status = dto.status ?? 'sent';
    let targetPhone: string | null = null;

    if (dto.patientId) {
      const patient = await this.patientsRepository.findById(dto.patientId);
      targetPhone = patient?.phone ?? null;
    } else if (dto.doctorId) {
      const doctor = await this.prisma.doctor.findUnique({ where: { id: dto.doctorId } });
      targetPhone = doctor?.phone ?? null;
    }

    if (dto.type === 'sms' && this.eskiz.isConfigured()) {
      targetPhone = targetPhone ? this.eskiz.normalizeMobile(targetPhone) : null;
      if (!targetPhone) {
        status = 'failed';
      } else {
        const r = await this.eskiz.sendSms(targetPhone, dto.message);
        status = r.ok ? 'sent' : 'failed';
      }
    }

    const n = await this.notificationsRepository.create({
      patient: dto.patientId ? { connect: { id: dto.patientId } } : undefined,
      doctor: dto.doctorId ? { connect: { id: dto.doctorId } } : undefined,
      type: dto.type,
      message: dto.message,
      status,
      sentAt,
    });
    return this.toResponse(n);
  }

  async sendReminders() {
    const { data: bookings } = await this.bookingsRepository.findAll({
      status: { in: ['confirmed', 'pending'] } as any,
      reminderSentAt: null,
    });
    if (!bookings.length) {
      return { created: 0 };
    }

    const patientIds = bookings.map((b) => b.patientId);
    const patientRows =
      await this.patientsRepository.findSourcesByPatientIds(patientIds);
    const phoneRows =
      await this.patientsRepository.findPhonesByPatientIds(patientIds);
    const sourceByPatientId = new Map(patientRows.map((p) => [p.id, p.source]));
    const phoneByPatientId = new Map(phoneRows.map((p) => [p.id, p.phone]));

    const rows: {
      patientId: string;
      type: ReminderType;
      message: string;
      status: ReminderStatus;
      sentAt: Date;
    }[] = [];
    const bookingIdsToMark: string[] = [];
    let smsSent = 0;
    let smsFailed = 0;
    const eskizOn = this.eskiz.isConfigured();

    const concurrency = 5;
    const results = await mapWithConcurrency(
      bookings,
      concurrency,
      async (b) => {
        const source = sourceByPatientId.get(b.patientId);
        if (source === undefined) return null;

        const message = `Eslatma: Sizning qabulingiz ${this.formatBookingDate(b.date)} kuni soat ${b.time} da`;
        const sentAt = new Date();

        // Telegram => immediate "sent" and mark booking.
        if (source === 'telegram') {
          return {
            row: {
              patientId: b.patientId,
              type: 'telegram' as const,
              message,
              status: 'sent' as const,
              sentAt,
            },
            bookingIdToMark: b.id,
            smsSentInc: 0,
            smsFailedInc: 0,
          };
        }

        // SMS path
        const type: ReminderType = 'sms';

        if (!eskizOn) {
          return {
            row: {
              patientId: b.patientId,
              type,
              message,
              status: 'sent' as const,
              sentAt,
            },
            bookingIdToMark: b.id,
            smsSentInc: 0,
            smsFailedInc: 0,
          };
        }

        const rawPhone = phoneByPatientId.get(b.patientId);
        const mobile = rawPhone ? this.eskiz.normalizeMobile(rawPhone) : null;
        if (!mobile) {
          return {
            row: {
              patientId: b.patientId,
              type,
              message,
              status: 'failed' as const,
              sentAt,
            },
            bookingIdToMark: null,
            smsSentInc: 0,
            smsFailedInc: 1,
          };
        }

        const r = await this.eskiz.sendSms(mobile, message);
        if (r.ok) {
          return {
            row: {
              patientId: b.patientId,
              type,
              message,
              status: 'sent' as const,
              sentAt,
            },
            bookingIdToMark: b.id,
            smsSentInc: 1,
            smsFailedInc: 0,
          };
        }

        return {
          row: {
            patientId: b.patientId,
            type,
            message,
            status: 'failed' as const,
            sentAt,
          },
          bookingIdToMark: null,
          smsSentInc: 0,
          smsFailedInc: 1,
        };
      },
    );

    for (const r of results) {
      if (!r) continue;
      rows.push(r.row);
      if (r.bookingIdToMark) bookingIdsToMark.push(r.bookingIdToMark);
      smsSent += r.smsSentInc;
      smsFailed += r.smsFailedInc;
    }

    if (rows.length) {
      const markAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.notification.createMany({ data: rows });
        if (bookingIdsToMark.length) {
          await tx.booking.updateMany({
            where: { id: { in: bookingIdsToMark }, reminderSentAt: null },
            data: { reminderSentAt: markAt },
          });
        }
      });
    }

    return eskizOn
      ? { created: rows.length, smsSent, smsFailed }
      : { created: rows.length };
  }

  async findRecipients(query: RecipientQueryDto) {
    const { startDate, endDate, targetType } = query;

    const dateStart = new Date(startDate || new Date().toISOString());
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(endDate || new Date().toISOString());
    dateEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        date: { gte: dateStart, lte: dateEnd },
        status: { in: ['confirmed', 'pending'] },
        // Only filter by reminderSentAt for patients
        ...(targetType === 'patient' ? { reminderSentAt: null } : {}),
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        }
      },
      orderBy: { date: 'asc' },
    });

    if (targetType === 'doctor') {
      const doctorMap = new Map();
      bookings.forEach((b) => {
        if (!b.doctorId) return;
        if (!doctorMap.has(b.doctorId)) {
          doctorMap.set(b.doctorId, {
            id: b.doctorId,
            firstName: b.doctor?.firstName || '',
            lastName: b.doctor?.lastName || '',
            phone: b.doctor?.phone || '',
            bookingId: b.id,
            bookingDate: toDateOnlyString(b.date),
            bookingTime: b.time,
            patientName: (b as any).patient ? `${(b as any).patient.firstName} ${(b as any).patient.lastName}` : '',
          });
        }
      });
      return Array.from(doctorMap.values());
    }

    const patientMap = new Map();
    bookings.forEach((b) => {
      if (!patientMap.has(b.patientId)) {
        patientMap.set(b.patientId, {
          ...(b as any).patient,
          bookingId: b.id,
          bookingDate: toDateOnlyString(b.date),
          bookingTime: b.time,
        });
      }
    });

    return Array.from(patientMap.values());
  }

  async bulkSend(dto: BulkSendDto) {
    const { targetIds, targetType, message } = dto;
    const eskizOn = this.eskiz.isConfigured();
    const results = { sent: 0, failed: 0 };
    const markAt = new Date();

    const targets = targetType === 'doctor' 
      ? await this.prisma.doctor.findMany({
          where: { id: { in: targetIds } },
          select: { 
            id: true, 
            phone: true,
            bookings: {
              where: {
                date: { gte: startOfUTCDay(new Date()) },
                status: { in: ['confirmed', 'pending'] },
              },
              include: { patient: true },
              orderBy: { date: 'asc' },
              take: 1,
            }
          }
        })
      : await this.prisma.patient.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            phone: true,
            bookings: {
              where: {
                date: { gte: startOfUTCDay(new Date()) },
                status: { in: ['confirmed', 'pending'] },
                reminderSentAt: null,
              },
              include: { patient: true },
              orderBy: { date: 'asc' },
              take: 1,
            },
          },
        });

    const notificationRows: any[] = [];
    const bookingIdsToMark: string[] = [];

    const concurrency = 5;
    const taskResults = await mapWithConcurrency(
      targets as any[],
      concurrency,
      async (target) => {
        const mobile = this.eskiz.normalizeMobile(target.phone);
        let status: ReminderStatus = 'sent';
        const booking = target.bookings?.[0];

        let personalizedMessage = message;
        if (booking) {
          personalizedMessage = personalizedMessage
            .replace(/\[sana\]/g, toDateOnlyString(booking.date))
            .replace(/\[vaqt\]/g, booking.time);
          if (booking.patient) {
            personalizedMessage = personalizedMessage.replace(/\[bemor\]/g, `${booking.patient.firstName} ${booking.patient.lastName}`);
          }
        }

        let sentInc = 0;
        let failedInc = 0;
        let bookingIdToMark: string | null = null;

        if (eskizOn && mobile) {
          const r = await this.eskiz.sendSms(mobile, personalizedMessage);
          status = r.ok ? 'sent' : 'failed';
          if (r.ok) {
            sentInc = 1;
            bookingIdToMark = booking?.id ?? null;
          } else {
            failedInc = 1;
          }
        } else {
          status = mobile ? 'sent' : 'failed';
          if (status === 'sent') {
            sentInc = 1;
            bookingIdToMark = booking?.id ?? null;
          } else {
            failedInc = 1;
          }
        }

        const row = {
          patientId: targetType === 'patient' ? target.id : undefined,
          doctorId: targetType === 'doctor' ? target.id : undefined,
          type: 'sms' as const,
          message: personalizedMessage,
          status,
          sentAt: markAt,
        };

        return { row, bookingIdToMark, sentInc, failedInc };
      },
    );

    for (const tr of taskResults) {
      notificationRows.push(tr.row);
      if (tr.bookingIdToMark) bookingIdsToMark.push(tr.bookingIdToMark);
      results.sent += tr.sentInc;
      results.failed += tr.failedInc;
    }

    if (notificationRows.length || bookingIdsToMark.length) {
      await this.prisma.$transaction(async (tx) => {
        if (notificationRows.length) {
          await tx.notification.createMany({ data: notificationRows });
        }
        if (bookingIdsToMark.length) {
          await tx.booking.updateMany({
            where: {
              id: { in: bookingIdsToMark },
              reminderSentAt: null,
            },
            data: { reminderSentAt: markAt },
          });
        }
      });
    }

    return { ...results, total: targetIds.length };
  }

  private formatBookingDate(d: Date) {
    return toDateOnlyString(d);
  }

  private toResponse(n: Notification) {
    return {
      id: n.id,
      patientId: n.patientId,
      doctorId: n.doctorId,
      type: n.type,
      message: n.message,
      sentAt: n.sentAt.toISOString(),
      status: n.status,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  const worker = async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  };

  const workers = Array.from({ length: Math.max(1, concurrency) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
