import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { PaginationDto } from 'src/utils/paginations'
import { PatientCreateDto, PatientFilterDto, PatientUpdateDto } from './dto'

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PatientFilterDto) {
    const { page, pageSize, search, sortBy, source, gender, branchId } = pagination

    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (source) where.source = source
    if (gender) where.gender = gender
    if (branchId) where.branchId = branchId

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: { branch: { select: { id: true, name: true } } },
      }),
      this.prisma.patient.count({ where }),
    ])

    return {
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
    }
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { bookings: true, medicalRecs: true, payments: true } },
      },
    })
    if (!patient) throw new NotFoundException(`Bemor topilmadi: ${id}`)
    return patient
  }

  async findPatientBookings(patientId: string, pagination: PaginationDto) {
    await this.findOne(patientId)
    const { page, pageSize } = pagination
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { patientId },
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: { select: { id: true, firstName: true, lastName: true } },
          service: { select: { id: true, name: true, price: true } },
        },
      }),
      this.prisma.booking.count({ where: { patientId } }),
    ])
    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findPatientMedicalRecords(patientId: string, pagination: PaginationDto) {
    await this.findOne(patientId)
    const { page, pageSize } = pagination
    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where: { patientId },
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { visitDate: 'desc' },
        include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.medicalRecord.count({ where: { patientId } }),
    ])
    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findPatientPayments(patientId: string, pagination: PaginationDto) {
    await this.findOne(patientId)
    const { page, pageSize } = pagination
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { patientId },
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { patientId } }),
    ])
    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async create(data: PatientCreateDto) {
    return this.prisma.patient.create({ data })
  }

  async update(id: string, data: PatientUpdateDto) {
    await this.findOne(id)
    return this.prisma.patient.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.patient.delete({ where: { id } })
  }
}
