import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { CreateMedicalRecordDto, MedicalRecordFilterDto, UpdateMedicalRecordDto } from './dto'

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: MedicalRecordFilterDto) {
    const { page, pageSize, search, sortBy, patientId, doctorId, dateFrom, dateTo } = pagination

    const where: any = {}
    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId
    if (dateFrom || dateTo) {
      where.visitDate = {}
      if (dateFrom) where.visitDate.gte = new Date(dateFrom)
      if (dateTo) where.visitDate.lte = new Date(dateTo)
    }
    if (search) {
      where.OR = [
        { diagnosis: { contains: search, mode: 'insensitive' } },
        { treatmentNotes: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { visitDate: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.medicalRecord.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { select: { id: true, firstName: true, lastName: true } },
        booking: { select: { id: true, date: true, startTime: true, service: true } },
      },
    })
    if (!record) throw new NotFoundException(`Tibbiy yozuv topilmadi: ${id}`)
    return record
  }

  async create(data: CreateMedicalRecordDto) {
    return this.prisma.medicalRecord.create({
      data: { ...data, visitDate: new Date(data.visitDate) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  async update(id: string, data: UpdateMedicalRecordDto) {
    await this.findOne(id)
    const updateData: any = { ...data }
    if (data.visitDate) updateData.visitDate = new Date(data.visitDate)
    return this.prisma.medicalRecord.update({ where: { id }, data: updateData })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.medicalRecord.delete({ where: { id } })
  }
}
