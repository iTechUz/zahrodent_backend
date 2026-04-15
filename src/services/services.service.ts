import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { ServicesRepository } from './services.repository';
import { PaginationQueryDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async findAll(query: PaginationQueryDto & { category?: string }): Promise<PaginatedResponse<any>> {
    const { page = 0, limit = 10, search, category } = query;
    const skip = page * limit;

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

    const { data, total } = await this.servicesRepository.findAll(where, { skip, take: limit });
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
    await this.servicesRepository.delete(id);
    return { id };
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
