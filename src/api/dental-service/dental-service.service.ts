import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma.service'
import { CreateServiceDto, ServiceFilterDto, UpdateServiceDto } from './dto'

@Injectable()
export class DentalServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: ServiceFilterDto) {
    const { page, pageSize, search, sortBy, branchId, isActive } = pagination

    const where: any = {}
    if (branchId) where.branchId = branchId
    if (isActive !== undefined) where.isActive = isActive
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { name: sortBy?.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: { branch: { select: { id: true, name: true } } },
      }),
      this.prisma.service.count({ where }),
    ])

    return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } }
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true } } },
    })
    if (!service) throw new NotFoundException(`Xizmat topilmadi: ${id}`)
    return service
  }

  async create(data: CreateServiceDto) {
    return this.prisma.service.create({ data })
  }

  async update(id: string, data: UpdateServiceDto) {
    await this.findOne(id)
    return this.prisma.service.update({ where: { id }, data })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.service.update({ where: { id }, data: { isActive: false } })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.service.delete({ where: { id } })
  }
}
