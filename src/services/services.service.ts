import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { dateOnlyColumnRange } from '../common/utils/date.util';
import { Prisma, Service } from '@prisma/client';
import { ServicesRepository } from './services.repository';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { ServicesQueryDto } from './dto/services-query.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

export const serviceInUseMessage = (bookings: number, payments: number) =>
  `Xizmatni o'chirib bo'lmaydi: ${bookings} ta qabul va ${payments} ta to'lovga bog'langan (tarix buzilmasligi uchun)`;

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async findAll(
    query: ServicesQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ServicesService['toResponse']>>> {
    const { search, category } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.ServiceWhereInput = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await this.servicesRepository.findAll(where, {
      skip,
      take: limitNum,
      ...orderByOption<Prisma.ServiceOrderByWithRelationInput[]>(query, 'name'),
    });
    return { data: data.map((x) => this.toResponse(x)), total };
  }

  async findOne(id: string) {
    const s = await this.servicesRepository.findById(id);
    if (!s) throw new NotFoundException('Service not found');
    return this.toResponse(s);
  }

  async create(dto: CreateServiceDto) {
    const s = await this.servicesRepository.create({
      name: dto.name,
      category: dto.category,
      price: dto.price,
      duration: dto.duration,
      description: dto.description,
    });
    return this.toResponse(s);
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.ensureExists(id);
    const s = await this.servicesRepository.update(id, {
      name: dto.name,
      category: dto.category,
      price: dto.price,
      duration: dto.duration,
      description: dto.description,
    });
    return this.toResponse(s);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    // FK is ON DELETE SET NULL: deleting would silently strip the service from
    // booking/payment history (and from service revenue stats) → block.
    const usage = await this.servicesRepository.countUsage(id);
    if (usage.bookings > 0 || usage.payments > 0) {
      throw new ConflictException(
        serviceInUseMessage(usage.bookings, usage.payments),
      );
    }
    await this.servicesRepository.delete(id);
    return { id };
  }

  async getStats(period: { startDate?: string; endDate?: string } = {}) {
    const totalCount = await this.servicesRepository.count();
    const categoriesCount = await this.servicesRepository.countCategories();
    const avgPrice = await this.servicesRepository.getAvgPrice();
    const detailed = await this.servicesRepository.getDetailedStats(
      dateOnlyColumnRange(period.startDate, period.endDate),
    );

    return {
      totalCount,
      categoriesCount,
      avgPrice,
      detailed,
    };
  }

  private async ensureExists(id: string) {
    const s = await this.servicesRepository.findById(id);
    if (!s) throw new NotFoundException('Service not found');
  }

  private toResponse(s: Service) {
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      duration: s.duration,
      description: s.description ?? undefined,
    };
  }
}
