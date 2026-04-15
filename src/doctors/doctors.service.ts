import { Injectable, NotFoundException } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { DoctorsRepository } from './doctors.repository';
import { PaginationQueryDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(private readonly doctorsRepository: DoctorsRepository) {}

  async findAll(query: PaginationQueryDto & { specialty?: string }): Promise<PaginatedResponse<any>> {
    const { page = 0, limit = 10, search, specialty } = query;
    const skip = page * limit;

    const where: Prisma.DoctorWhereInput = {};

    if (specialty && specialty !== 'all') {
      where.specialty = specialty;
    }

    if (search?.trim()) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const { data, total } = await this.doctorsRepository.findAll(where, { skip, take: limit });
    return { data: data.map((d) => this.toResponse(d)), total };
  }

  async findOne(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException('Doctor not found');
    return this.toResponse(d);
  }

  async create(dto: CreateDoctorDto) {
    const d = await this.doctorsRepository.create({
      name: dto.name,
      specialty: dto.specialty,
      phone: dto.phone,
      workingHours: dto.workingHours,
      avatar: dto.avatar,
      schedule:
        dto.schedule === undefined ? undefined : (dto.schedule as object),
      daysOff: dto.daysOff === undefined ? undefined : dto.daysOff,
    });
    return this.toResponse(d);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    await this.ensureExists(id);
    const d = await this.doctorsRepository.update(id, {
      name: dto.name,
      specialty: dto.specialty,
      phone: dto.phone,
      workingHours: dto.workingHours,
      avatar: dto.avatar,
      schedule:
        dto.schedule === undefined ? undefined : (dto.schedule as object),
      daysOff: dto.daysOff === undefined ? undefined : dto.daysOff,
    });
    return this.toResponse(d);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.doctorsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException('Doctor not found');
  }

  private toResponse(d: Doctor) {
    return {
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      phone: d.phone,
      workingHours: d.workingHours,
      avatar: d.avatar ?? undefined,
      schedule: d.schedule ?? undefined,
      daysOff: (d.daysOff as string[] | null) ?? undefined,
    };
  }
}
