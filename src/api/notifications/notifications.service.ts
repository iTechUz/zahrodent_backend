import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { NotificationStatus, NotificationType } from 'src/constantis'
import {
  BookingReminderDto,
  BulkNotificationDto,
  CreateNotificationDto,
  NotificationFilterDto,
} from './dto'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: NotificationFilterDto) {
    const { page, pageSize, search, sortBy, type, recipientId } = pagination

    const where: any = {}
    if (type) where.type = type
    if (recipientId) where.recipientId = recipientId
    if (search) where.message = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } })
    if (!notification) throw new NotFoundException(`Bildirishnoma topilmadi: ${id}`)
    return notification
  }

  async send(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? NotificationStatus.PENDING : NotificationStatus.SENT,
        sentAt: data.scheduledAt ? null : new Date(),
      },
    })

    if (!data.scheduledAt) {
      await this.dispatchNotification(notification.type, notification.recipientId, notification.message)
    }

    return notification
  }

  async sendBulk(dto: BulkNotificationDto) {
    const notifications = await this.prisma.$transaction(
      dto.recipientIds.map((recipientId) =>
        this.prisma.notification.create({
          data: {
            type: dto.type,
            recipientId,
            message: dto.message,
            status: NotificationStatus.SENT,
            sentAt: new Date(),
          },
        }),
      ),
    )

    await Promise.allSettled(
      dto.recipientIds.map((id) => this.dispatchNotification(dto.type, id, dto.message)),
    )

    return { sent: notifications.length }
  }

  async sendBookingReminder(dto: BookingReminderDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { patient: true, doctor: true },
    })
    if (!booking) throw new NotFoundException(`Bron topilmadi: ${dto.bookingId}`)

    const dateStr = new Date(booking.date).toLocaleDateString('uz-UZ')
    const message = `Hurmatli ${booking.patient.firstName}, ${dateStr} kuni soat ${booking.startTime} da qabulingiz bor.`

    return this.send({
      type: NotificationType.SMS,
      recipientId: booking.patient.id,
      message,
    })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.notification.delete({ where: { id } })
  }

  private async dispatchNotification(type: string, recipientId: string, message: string) {
    // SMS va Telegram integratsiya shu yerda amalga oshiriladi
    // Masalan: await this.smsService.send(phone, message)
    // await this.telegramService.send(chatId, message)
  }
}
