import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PaginationQueryDto, PaginatedResponse } from '../common/dto/pagination.dto';

type ReminderType = 'sms' | 'telegram';
type ReminderStatus = 'sent' | 'failed';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly eskiz: EskizService,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<any>> {
    const { page = 0, limit = 10 } = query;
    const skip = page * limit;

    const { data, total } = await this.notificationsRepository.findAll({ skip, take: limit });
    return { data: data.map((n) => this.toResponse(n)), total };
  }

  async create(dto: CreateNotificationDto) {
    const sentAt = dto.sentAt ? new Date(dto.sentAt) : new Date();
    let status = dto.status ?? 'sent';

    if (dto.type === 'sms' && this.eskiz.isConfigured()) {
      const patient = await this.patientsRepository.findById(dto.patientId);
      const phone = patient?.phone
        ? this.eskiz.normalizeMobile(patient.phone)
        : null;
      if (!phone) {
        status = 'failed';
      } else {
        const r = await this.eskiz.sendSms(phone, dto.message);
        status = r.ok ? 'sent' : 'failed';
      }
    }

    const n = await this.notificationsRepository.create({
      patient: { connect: { id: dto.patientId } },
      type: dto.type,
      message: dto.message,
      status,
      sentAt,
    });
    return this.toResponse(n);
  }

  async sendReminders() {
    const bookings = await this.bookingsRepository.findAll({
      status: { in: ['confirmed', 'pending'] },
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

    for (const b of bookings) {
      const source = sourceByPatientId.get(b.patientId);
      if (source === undefined) continue;

      const message = `Eslatma: Sizning qabulingiz ${this.formatBookingDate(b.date)} kuni soat ${b.time} da`;
      const sentAt = new Date();

      if (source === 'telegram') {
        rows.push({
          patientId: b.patientId,
          type: 'telegram',
          message,
          status: 'sent',
          sentAt,
        });
        bookingIdsToMark.push(b.id);
        continue;
      }

      const type = 'sms';

      if (!eskizOn) {
        rows.push({
          patientId: b.patientId,
          type,
          message,
          status: 'sent',
          sentAt,
        });
        bookingIdsToMark.push(b.id);
        continue;
      }

      const rawPhone = phoneByPatientId.get(b.patientId);
      const mobile = rawPhone ? this.eskiz.normalizeMobile(rawPhone) : null;
      if (!mobile) {
        rows.push({
          patientId: b.patientId,
          type,
          message,
          status: 'failed',
          sentAt,
        });
        smsFailed += 1;
        continue;
      }

      const r = await this.eskiz.sendSms(mobile, message);
      if (r.ok) {
        rows.push({
          patientId: b.patientId,
          type,
          message,
          status: 'sent',
          sentAt,
        });
        bookingIdsToMark.push(b.id);
        smsSent += 1;
      } else {
        rows.push({
          patientId: b.patientId,
          type,
          message,
          status: 'failed',
          sentAt,
        });
        smsFailed += 1;
      }
    }

    if (rows.length) {
      const markAt = new Date();
      await this.notificationsRepository.createMany(rows);
      if (bookingIdsToMark.length) {
        await this.bookingsRepository.markReminderSent(
          bookingIdsToMark,
          markAt,
        );
      }
    }

    return eskizOn
      ? { created: rows.length, smsSent, smsFailed }
      : { created: rows.length };
  }

  private formatBookingDate(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  private toResponse(n: Notification) {
    return {
      id: n.id,
      patientId: n.patientId,
      type: n.type,
      message: n.message,
      sentAt: n.sentAt.toISOString(),
      status: n.status,
    };
  }
}
