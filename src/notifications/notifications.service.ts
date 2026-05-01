import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { EskizService } from './eskiz.service';
import { PrismaService } from '../database/prisma.service';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { RecipientQueryDto, BulkSendDto } from './dto/bulk-sms.dto';

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
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: dto.doctorId },
        include: { user: true },
      });
      targetPhone = doctor?.user?.phone ?? null;
    }

    if (dto.type === 'sms' && this.eskiz.isConfigured()) {
      targetPhone = targetPhone
        ? this.eskiz.normalizeMobile(targetPhone)
        : null;
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0,0,0,0);
    const afterTomorrow = new Date(tomorrow);
    afterTomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        startTime: { gte: tomorrow, lt: afterTomorrow },
        status: 'CONFIRMED',
        reminderSentAt: null,
      },
      include: { patient: true },
    });

    for (const b of bookings) {
      if (b.patient?.phone) {
        const message = `Eslatma: Sizning qabulingiz ertaga soat ${b.startTime.toISOString().split('T')[1].substring(0, 5)} da.`;
        await this.create({
          patientId: b.patientId,
          type: 'sms',
          message,
          status: 'sent',
        });
        await this.prisma.booking.update({
          where: { id: b.id },
          data: { reminderSentAt: new Date() },
        });
      }
    }
    return { count: bookings.length };
  }

  async findRecipients(query: RecipientQueryDto) {
    const { startDate, endDate, targetType } = query;
    const isDoctor = targetType.toLowerCase() === 'doctor';

    const dateStart = new Date(startDate || new Date().toISOString());
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(endDate || new Date().toISOString());
    dateEnd.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        startTime: { gte: dateStart, lte: dateEnd },
        status: { in: ['CONFIRMED', 'PENDING'] },
        ...(targetType === 'patient' ? { reminderSentAt: null } : {}),
      },
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    if (isDoctor) {
      const doctorMap = new Map();
      bookings.forEach((b) => {
        if (!doctorMap.has(b.doctorId)) {
          doctorMap.set(b.doctorId, {
            id: b.doctorId,
            name: b.doctor?.user?.name || '',
            phone: b.doctor?.user?.phone || '',
            bookingId: b.id,
            bookingDate: b.startTime.toISOString().split('T')[0],
            bookingTime: b.startTime.toISOString().split('T')[1].substring(0, 5),
            patientName: b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : '',
          });
        }
      });
      return Array.from(doctorMap.values());
    }

    const patientMap = new Map();
    bookings.forEach((b) => {
      if (!patientMap.has(b.patientId)) {
        patientMap.set(b.patientId, {
          ...b.patient,
          bookingId: b.id,
          bookingDate: b.startTime.toISOString().split('T')[0],
          bookingTime: b.startTime.toISOString().split('T')[1].substring(0, 5),
        });
      }
    });

    return Array.from(patientMap.values());
  }

  async bulkSend(dto: BulkSendDto) {
    const { targetIds, targetType, message } = dto;
    const isDoctor = targetType.toLowerCase() === 'doctor';
    const eskizOn = this.eskiz.isConfigured();
    const results = { sent: 0, failed: 0 };
    const markAt = new Date();

    const targets = isDoctor
        ? await this.prisma.doctor.findMany({
            where: { id: { in: targetIds } },
            select: {
              id: true,
              user: { select: { phone: true, name: true } },
              bookings: {
                where: {
                  startTime: { gte: new Date() },
                  status: { in: ['CONFIRMED', 'PENDING'] },
                },
                orderBy: { startTime: 'asc' },
                take: 1,
              },
            },
          })
        : await this.prisma.patient.findMany({
            where: { id: { in: targetIds } },
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              bookings: {
                where: {
                  startTime: { gte: new Date() },
                  status: { in: ['CONFIRMED', 'PENDING'] },
                  reminderSentAt: null,
                },
                orderBy: { startTime: 'asc' },
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
        const phone = isDoctor ? target.user?.phone : target.phone;
        const mobile = this.eskiz.normalizeMobile(phone);
        let status: ReminderStatus = 'sent';
        const booking = target.bookings?.[0];

        let personalizedMessage = message;
        if (booking) {
          personalizedMessage = personalizedMessage
            .replace(/\[sana\]/g, booking.startTime.toISOString().split('T')[0])
            .replace(/\[vaqt\]/g, booking.startTime.toISOString().split('T')[1].substring(0, 5));
          
          if (!isDoctor) {
             personalizedMessage = personalizedMessage.replace(
              /\[bemor\]/g,
              `${target.firstName} ${target.lastName}`,
            );
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
          patientId: !isDoctor ? target.id : undefined,
          doctorId: isDoctor ? target.id : undefined,
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
