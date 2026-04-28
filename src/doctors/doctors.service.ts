import { Injectable, NotFoundException } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { DoctorsRepository } from './doctors.repository';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
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
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await this.doctorsRepository.findAll(where, {
      skip,
      take: limitNum,
    });
    return { data: data.map((d) => this.toResponse(d as any)), total };
  }

  async findOne(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException('Doctor not found');
    return this.toResponse(d);
  }

  async create(dto: CreateDoctorDto) {
    let userId: string | undefined;

    if (dto.password) {
      const user = await this.usersService.create({
        name: `${dto.firstName} ${dto.lastName}`,
        phone: dto.phone,
        password: dto.password,
        role: 'doctor',
        specialty: dto.specialty,
        avatar: dto.avatar,
      });
      userId = user.id;
    }

    const d = await this.doctorsRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      specialty: dto.specialty,
      phone: dto.phone,
      avatar: dto.avatar,
      user: userId ? { connect: { id: userId } } : undefined,
      schedule: dto.schedule,
      daysOff: dto.daysOff,
    });
    return this.toResponse(d);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const existingDoctor = await this.doctorsRepository.findById(id);
    if (!existingDoctor) throw new NotFoundException('Doctor not found');

    let userId = existingDoctor.userId;

    // Handle user account updates or creation
    if (dto.password) {
      if (userId) {
        // Update existing user
        await this.usersService.update(userId, {
          name:
            dto.firstName && dto.lastName
              ? `${dto.firstName} ${dto.lastName}`
              : existingDoctor.firstName + ' ' + existingDoctor.lastName,
          phone: dto.phone || existingDoctor.phone,
          password: dto.password,
          specialty: dto.specialty,
          avatar: dto.avatar,
        });
      } else {
        // Create new user if not exists but credentials provided
        const user = await this.usersService.create({
          name: `${dto.firstName || existingDoctor.firstName} ${
            dto.lastName || existingDoctor.lastName
          }`,
          phone: dto.phone || existingDoctor.phone,
          password: dto.password,
          role: 'doctor',
          specialty: dto.specialty || existingDoctor.specialty,
          avatar: dto.avatar || existingDoctor.avatar || undefined,
        });
        userId = user.id;
      }
    }

    const d = await this.doctorsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      specialty: dto.specialty,
      phone: dto.phone,
      avatar: dto.avatar,
      user: userId ? { connect: { id: userId } } : undefined,
      schedule: dto.schedule,
      daysOff: dto.daysOff,
    });
    return this.toResponse(d);
  }

  async remove(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException('Doctor not found');

    if (d.userId) {
      await this.usersService.remove(d.userId);
    }

    await this.doctorsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException('Doctor not found');
  }

  async getStats() {
    const total = await this.doctorsRepository.count();

    // Active today: doctors with at least one booking today
    const { count: activeToday } =
      await this.doctorsRepository.getActiveCountToday();

    // Total visits count (historical)
    const { count: totalVisits } =
      await this.doctorsRepository.getTotalVisitsCount();

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
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by revenue by default
  }

  private toResponse(d: Doctor & { user?: { phone: string } | null }) {
    return {
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty,
      phone: d.phone,
      loginPhone: d.user?.phone,
      avatar: d.avatar ?? undefined,
      schedule: d.schedule ?? undefined,
      daysOff: (d.daysOff as string[] | null) ?? undefined,
    };
  }
}
