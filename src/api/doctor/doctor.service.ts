import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { PaginationDto } from 'src/utils/paginations'
import { RolesEnum } from 'src/constantis'
import { CreateScheduleDto, DoctorFilterDto, UpdateScheduleDto } from './dto'

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: DoctorFilterDto) {
    const { page, pageSize, search, sortBy, branchId } = pagination

    const where: any = { roles: { name: RolesEnum.DOCTOR } }

    if (branchId) where.branches = { some: { id: branchId } }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
          status: true,
          branches: { select: { id: true, name: true } },
          schedules: true,
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const doctor = await this.prisma.user.findFirst({
      where: { id, roles: { name: RolesEnum.DOCTOR } },
      include: {
        roles: { select: { id: true, name: true } },
        branches: { select: { id: true, name: true } },
        schedules: true,
        _count: { select: { bookings: true, medicalRecords: true } },
      },
    })
    if (!doctor) throw new NotFoundException(`Shifokor topilmadi: ${id}`)
    return doctor
  }

  async getSchedule(doctorId: string, branchId?: string) {
    await this.findOne(doctorId)
    const where: any = { doctorId }
    if (branchId) where.branchId = branchId
    return this.prisma.doctorSchedule.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { dayOfWeek: 'asc' },
    })
  }

  async getAssignedPatients(doctorId: string, pagination: PaginationDto) {
    await this.findOne(doctorId)
    const { page, pageSize } = pagination

    const patientIds = await this.prisma.booking.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    })

    const ids = patientIds.map((b) => b.patientId)

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where: { id: { in: ids } },
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where: { id: { in: ids } } }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async getDoctorBookings(doctorId: string, pagination: PaginationDto) {
    await this.findOne(doctorId)
    const { page, pageSize } = pagination

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { doctorId },
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { date: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          service: { select: { id: true, name: true } },
        },
      }),
      this.prisma.booking.count({ where: { doctorId } }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async upsertSchedule(doctorId: string, data: CreateScheduleDto) {
    await this.findOne(doctorId)
    const { branchId, dayOfWeek, ...rest } = data
    return this.prisma.doctorSchedule.upsert({
      where: { doctorId_branchId_dayOfWeek: { doctorId, branchId, dayOfWeek } },
      create: { doctorId, branchId, dayOfWeek, ...rest },
      update: { ...rest },
    })
  }

  async updateSchedule(scheduleId: string, data: UpdateScheduleDto) {
    const schedule = await this.prisma.doctorSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule) throw new NotFoundException(`Jadval topilmadi: ${scheduleId}`)
    return this.prisma.doctorSchedule.update({ where: { id: scheduleId }, data })
  }

  async removeSchedule(scheduleId: string) {
    const schedule = await this.prisma.doctorSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule) throw new NotFoundException(`Jadval topilmadi: ${scheduleId}`)
    return this.prisma.doctorSchedule.delete({ where: { id: scheduleId } })
  }
}
