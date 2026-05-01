import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DoctorsRepository } from './doctors.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorsRepository: DoctorsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: { specialty?: string; branchId?: string }) {
    const where: any = { deletedAt: null };
    if (query.specialty) where.specialty = query.specialty;
    if (query.branchId) where.userId = { branchId: query.branchId };

    const doctors = await this.doctorsRepository.findAll(where);
    return doctors.map((d) => this.toResponse(d));
  }

  async findOne(id: string) {
    const doctor = await this.doctorsRepository.findById(id);
    if (!doctor || doctor.deletedAt) throw new NotFoundException('Doctor not found');
    return this.toResponse(doctor);
  }

  async getStats() {
    const [total, active] = await Promise.all([
      this.prisma.doctor.count({ where: { deletedAt: null } }),
      this.prisma.doctor.count({ where: { deletedAt: null, isActive: true } }),
    ]);
    return { total, active };
  }

  async getEfficiency() {
    // Basic implementation: average bookings per doctor this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const stats = await this.prisma.doctor.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        user: { select: { name: true } },
        _count: {
          select: {
            bookings: {
              where: { startTime: { gte: startOfMonth } }
            }
          }
        }
      }
    });

    return stats.map(s => ({
      doctorId: s.id,
      name: s.user.name,
      bookingsCount: s._count.bookings
    }));
  }

  async create(dto: CreateDoctorDto) {
    // Check if user exists and is not already a doctor
    const user = await this.doctorsRepository.findUserById(dto.userId);
    if (!user) throw new NotFoundException('User not found');
    
    const existing = await this.doctorsRepository.findById(dto.userId);
    if (existing) throw new ConflictException('User is already a doctor');

    const doctor = await this.doctorsRepository.create({
      user: { connect: { id: dto.userId } },
      specialty: dto.specialty,
      experienceYears: dto.experienceYears,
      bio: dto.bio,
      availabilities: {
        create: dto.availabilities?.map(a => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          slotDuration: a.slotDuration,
        }))
      }
    });
    return this.toResponse(doctor);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const doctor = await this.doctorsRepository.findById(id);
    if (!doctor || doctor.deletedAt) throw new NotFoundException('Doctor not found');

    const updateData: any = {
      specialty: dto.specialty,
      experienceYears: dto.experienceYears,
      bio: dto.bio,
      isActive: dto.isActive,
    };

    if (dto.availabilities) {
      updateData.availabilities = {
        deleteMany: {},
        create: dto.availabilities.map(a => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          slotDuration: a.slotDuration,
        }))
      };
    }

    const updated = await this.doctorsRepository.update(id, updateData);
    return this.toResponse(updated);
  }

  async remove(id: string) {
    const doctor = await this.doctorsRepository.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');

    return this.prisma.$transaction(async (tx) => {
      // 1. Deactivate User
      await tx.user.update({
        where: { id: doctor.userId },
        data: { isActive: false, deletedAt: new Date() },
      });

      // 2. Soft delete Doctor
      await tx.doctor.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      return { id };
    });
  }

  private toResponse(d: any) {
    return {
      ...d,
      name: d.user?.name,
      phone: d.user?.phone,
      email: d.user?.email,
      avatar: d.user?.avatar,
    };
  }
}
