import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { BookingStatus } from 'src/constantis'
import { GatewayService, WsEvent } from 'src/gateway/gateway.service'
import {
  AvailableSlotsDto,
  BookingFilterDto,
  CancelBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto'

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
  ) {}

  async findAll(pagination: BookingFilterDto) {
    const { page, pageSize, search, sortBy, doctorId, patientId, branchId, status, source, dateFrom, dateTo } =
      pagination

    const where: any = {}

    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId
    if (branchId) where.branchId = branchId
    if (status) where.status = status
    if (source) where.source = source
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    if (search) {
      where.OR = [
        { notes: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { phone: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { date: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
          service: { select: { id: true, name: true, price: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { select: { id: true, firstName: true, lastName: true, phone: true } },
        service: true,
        branch: { select: { id: true, name: true, address: true } },
        payment: true,
        medicalRecord: true,
      },
    })
    if (!booking) throw new NotFoundException(`Bron topilmadi: ${id}`)
    return booking
  }

  async getAvailableSlots(query: AvailableSlotsDto) {
    const { doctorId, branchId, date } = query
    const dayOfWeek = new Date(date).getDay()

    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { doctorId_branchId_dayOfWeek: { doctorId, branchId, dayOfWeek } },
    })

    if (!schedule || !schedule.isAvailable) {
      return { date, doctorId, slots: [] }
    }

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        doctorId,
        branchId,
        date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      select: { startTime: true },
    })

    const bookedTimes = new Set(existingBookings.map((b) => b.startTime))

    const slots: { time: string; available: boolean }[] = []
    const [startH, startM] = schedule.startTime.split(':').map(Number)
    const [endH, endM] = schedule.endTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    for (let minutes = startMinutes; minutes < endMinutes; minutes += schedule.slotDuration) {
      const h = String(Math.floor(minutes / 60)).padStart(2, '0')
      const m = String(minutes % 60).padStart(2, '0')
      const time = `${h}:${m}`
      slots.push({ time, available: !bookedTimes.has(time) })
    }

    return { date, doctorId, slots }
  }

  async create(data: CreateBookingDto) {
    const existing = await this.prisma.booking.findFirst({
      where: {
        doctorId: data.doctorId,
        date: new Date(data.date),
        startTime: data.startTime,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    })
    if (existing) throw new BadRequestException('Bu vaqtda bron mavjud')

    const booking = await this.prisma.booking.create({
      data: { ...data, date: new Date(data.date) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    })

    this.gatewayService.emitToBranch(booking.branchId, WsEvent.BOOKING_CREATED, booking)
    this.gatewayService.emitToDoctor(booking.doctorId, WsEvent.BOOKING_CREATED, booking)
    return booking
  }

  async update(id: string, data: UpdateBookingDto) {
    await this.findOne(id)
    const updateData: any = { ...data }
    if (data.date) updateData.date = new Date(data.date)
    const updated = await this.prisma.booking.update({ where: { id }, data: updateData })
    this.gatewayService.emitToBranch(updated.branchId, WsEvent.BOOKING_UPDATED, updated)
    return updated
  }

  async confirm(id: string) {
    const booking = await this.findOne(id)
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Faqat kutilayotgan bronni tasdiqlash mumkin')
    }
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.CONFIRMED } })
    this.gatewayService.emitToBranch(updated.branchId, WsEvent.BOOKING_CONFIRMED, updated)
    this.gatewayService.emitToDoctor(updated.doctorId, WsEvent.BOOKING_CONFIRMED, updated)
    return updated
  }

  async cancel(id: string, dto: CancelBookingDto) {
    const booking = await this.findOne(id)
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Yakunlangan bronni bekor qilib bo\'lmaydi')
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED, cancelReason: dto.cancelReason },
    })
    this.gatewayService.emitToBranch(updated.branchId, WsEvent.BOOKING_CANCELLED, updated)
    this.gatewayService.emitToDoctor(updated.doctorId, WsEvent.BOOKING_CANCELLED, updated)
    return updated
  }

  async complete(id: string) {
    const booking = await this.findOne(id)
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Faqat tasdiqlangan bronni yakunlash mumkin')
    }
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.COMPLETED } })
    this.gatewayService.emitToBranch(updated.branchId, WsEvent.BOOKING_COMPLETED, updated)
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.booking.delete({ where: { id } })
  }
}
