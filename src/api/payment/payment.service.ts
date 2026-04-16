import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { PaymentStatus } from 'src/constantis'
import { GatewayService, WsEvent } from 'src/gateway/gateway.service'
import { CreatePaymentDto, PaymentFilterDto, UpdatePaymentDto } from './dto'

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
  ) {}

  async findAll(pagination: PaymentFilterDto) {
    const { page, pageSize, sortBy, patientId, bookingId, status, paymentMethod, dateFrom, dateTo } = pagination

    const where: any = {}
    if (patientId) where.patientId = patientId
    if (bookingId) where.bookingId = bookingId
    if (status) where.status = status
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          booking: { select: { id: true, date: true, startTime: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        booking: true,
      },
    })
    if (!payment) throw new NotFoundException(`To'lov topilmadi: ${id}`)
    return payment
  }

  async getStats(dateFrom?: string, dateTo?: string, branchId?: string) {
    const where: any = {}
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }
    if (branchId) where.booking = { branchId }

    const [all, paid, pending] = await Promise.all([
      this.prisma.payment.aggregate({ _sum: { totalAmount: true }, where }),
      this.prisma.payment.aggregate({
        _sum: { totalAmount: true },
        where: { ...where, status: PaymentStatus.PAID },
      }),
      this.prisma.payment.aggregate({
        _sum: { totalAmount: true },
        where: { ...where, status: PaymentStatus.PENDING },
      }),
    ])

    const byMethod = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      _sum: { totalAmount: true },
      where: { ...where, status: PaymentStatus.PAID },
    })

    return {
      totalRevenue: all._sum.totalAmount ?? 0,
      totalPaid: paid._sum.totalAmount ?? 0,
      totalPending: pending._sum.totalAmount ?? 0,
      byMethod: Object.fromEntries(byMethod.map((m) => [m.paymentMethod, m._sum.totalAmount ?? 0])),
    }
  }

  async create(data: CreatePaymentDto) {
    const payment = await this.prisma.payment.create({
      data,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    })
    this.gatewayService.emitToUser(payment.patientId, WsEvent.PAYMENT_CREATED, payment)
    return payment
  }

  async update(id: string, data: UpdatePaymentDto) {
    await this.findOne(id)
    return this.prisma.payment.update({ where: { id }, data })
  }

  async confirm(id: string) {
    const payment = await this.findOne(id)
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Faqat kutilayotgan to\'lovni tasdiqlash mumkin')
    }
    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    })
    this.gatewayService.emitToUser(updated.patientId, WsEvent.PAYMENT_CONFIRMED, updated)
    return updated
  }

  async cancel(id: string) {
    const payment = await this.findOne(id)
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('To\'langan to\'lovni bekor qilib bo\'lmaydi')
    }
    return this.prisma.payment.update({ where: { id }, data: { status: PaymentStatus.CANCELLED } })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.payment.delete({ where: { id } })
  }
}
