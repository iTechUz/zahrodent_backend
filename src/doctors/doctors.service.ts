import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DoctorsRepository } from './doctors.repository';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorsRepository: DoctorsRepository,
  ) {}

  async findAll(
    query: PaginationQueryDto & { specialty?: string },
  ): Promise<PaginatedResponse<any>> {
    const { search, specialty } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.DoctorWhereInput = {};

    if (specialty && specialty !== 'all') {
      where.specialty = specialty;
    }

    if (search?.trim()) {
      where.user = {
        name: { contains: search, mode: 'insensitive' }
      };
    }

    const { data, total } = await this.doctorsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((d) => this.toResponse(d)), total };
  }

  async findOne(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d || d.deletedAt) throw new NotFoundException('Doctor not found');
    return this.toResponse(d);
  }

  async create(dto: CreateDoctorDto) {
    const d = await this.doctorsRepository.create({
      user: { connect: { id: dto.userId } },
      specialty: dto.specialty,
      experienceYears: dto.experienceYears,
      phone: dto.phone,
      bio: dto.bio,
      availabilities: dto.availabilities ? {
        createMany: {
          data: dto.availabilities.map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            slotDuration: a.slotDuration || 30,
          }))
        }
      } : undefined,
    });
    return this.toResponse(d);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const existing = await this.ensureExists(id);

    const d = await this.doctorsRepository.update(id, {
      specialty: dto.specialty,
      experienceYears: dto.experienceYears,
      phone: dto.phone,
      bio: dto.bio,
      availabilities: dto.availabilities ? {
        deleteMany: {},
        createMany: {
          data: dto.availabilities.map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            slotDuration: a.slotDuration || 30,
          }))
        }
      } : undefined,
    });
    return this.toResponse(d);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.doctorsRepository.softDelete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d || d.deletedAt) throw new NotFoundException('Doctor not found');
    return d;
  }

  async getStats() {
    const total = await this.doctorsRepository.count();
    const { count: activeToday } = await this.doctorsRepository.getActiveCountToday();
    const { count: totalVisits } = await this.doctorsRepository.getTotalVisitsCount();

    return {
      total,
      activeToday,
      totalVisits,
    };
  }

  async getEfficiency() {
    const rawStats = await this.doctorsRepository.getDetailedEfficiencyStats();

    return rawStats
      .map((s) => {
        const conversionRate =
          s.totalBookings > 0
            ? Math.round((s.totalVisits / s.totalBookings) * 100)
            : 0;

        const avgCheck =
          s.totalVisits > 0 ? Math.round(s.totalRevenue / s.totalVisits) : 0;

        return {
          ...s,
          conversionRate,
          avgCheck,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  private toResponse(d: any) {
    return {
      id: d.id,
      userId: d.userId,
      name: d.user?.name,
      specialty: d.specialty,
      experienceYears: d.experienceYears,
      phone: d.phone,
      bio: d.bio,
      avatar: d.user?.avatar,
      availabilities: d.availabilities,
    };
  }
}
