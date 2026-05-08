import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DoctorsRepository } from './doctors.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUserView } from '../auth/auth.service';
import { getPagination } from '../common/utils/pagination.util';

export interface DoctorResponse {
  id: string;
  userId: string;
  specialty: string;
  experienceYears: number;
  bio: string;
  isActive: boolean;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  availabilities: any[];
  schedule: Array<{
    day: number;
    startTime: string;
    endTime: string;
    isWorking: boolean;
  }>;
}

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorsRepository: DoctorsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: { specialty?: string; branchId?: string; page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPagination(query);
    
    const where: Prisma.DoctorWhereInput = { deletedAt: null };
    if (query.specialty) where.specialty = query.specialty;
    if (query.branchId) where.user = { branchId: query.branchId };

    const [doctors, total] = await Promise.all([
      this.doctorsRepository.findAll(where, { skip, take }),
      this.prisma.doctor.count({ where }),
    ]);

    return {
      data: doctors.map((d) => this.toResponse(d)),
      total,
    };
  }

  async findOne(id: string): Promise<DoctorResponse> {
    const doctor = await this.doctorsRepository.findById(id);
    if (!doctor || doctor.deletedAt) throw new NotFoundException('Doctor topilmadi');
    return this.toResponse(doctor);
  }

  async findByUserId(userId: string): Promise<DoctorResponse> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { userId, deletedAt: null },
      include: { user: true, availabilities: true },
    });
    if (!doctor) throw new NotFoundException('Doctor profili topilmadi');
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
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const doctors = await this.prisma.doctor.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        user: { select: { name: true } },
        bookings: {
          where: { startTime: { gte: startOfMonth } },
          select: { status: true }
        },
        payments: {
          where: { createdAt: { gte: startOfMonth }, type: 'INCOME' },
          select: { amount: true }
        }
      }
    });

    return doctors.map(d => {
      const totalBookings = d.bookings.length;
      const completedBookings = d.bookings.filter(b => b.status === 'COMPLETED').length;
      const totalRevenue = d.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const conversionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;
      const avgCheck = completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0;

      return {
        doctorId: d.id,
        name: d.user?.name || 'Noma\'lum',
        specialty: d.specialty,
        totalBookings,
        completedBookings,
        totalRevenue,
        conversionRate,
        avgCheck
      };
    });
  }

  async create(dto: CreateDoctorDto, currentUser: AuthUserView): Promise<DoctorResponse> {
    return this.prisma.$transaction(async (tx) => {
      let userId = dto.userId;

      if (!userId) {
        if (!dto.phone || !dto.password) {
          throw new ConflictException('Yangi shifokor uchun telefon va parol bo\'lishi shart');
        }
        
        const normalizedPhone = dto.phone.replace(/\D/g, '');
        const existingUser = await tx.user.findUnique({ where: { phone: normalizedPhone } });
        if (existingUser) throw new ConflictException('Ushbu telefon raqamli foydalanuvchi allaqachon mavjud');

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const newUser = await tx.user.create({
          data: {
            name: dto.name || `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim() || 'Shifokor',
            phone: normalizedPhone,
            passwordHash,
            role: 'DOCTOR',
            branchId: currentUser.branchId,
          },
        });
        userId = newUser.id;
      } else {
        const existing = await tx.doctor.findUnique({ where: { userId } });
        if (existing) throw new ConflictException('Bu foydalanuvchi allaqachon shifokor sifatida ro\'yxatdan o\'tgan');
      }

      const doctor = await tx.doctor.create({
        data: {
          user: { connect: { id: userId } },
          specialty: dto.specialty,
          experienceYears: Number(dto.experienceYears) || 0,
          bio: dto.bio || '',
          availabilities: {
            create: dto.availabilities?.map(a => ({
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime,
              endTime: a.endTime,
              slotDuration: a.slotDuration || 30,
            })) || []
          }
        },
        include: { 
          user: true, 
          availabilities: true 
        }
      });

      return this.toResponse(doctor);
    });
  }

  async update(id: string, dto: UpdateDoctorDto, currentUser?: AuthUserView): Promise<DoctorResponse> {
    return this.prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.findUnique({
        where: { id },
        include: { user: true }
      });
      if (!doctor || doctor.deletedAt) throw new NotFoundException('Shifokor topilmadi');

      if (currentUser?.role === 'DOCTOR' && doctor.userId !== currentUser.id) {
        throw new ForbiddenException('Siz faqat o\'z profilingizni tahrirlay olasiz');
      }

      const updateData: Prisma.DoctorUpdateInput = {
        specialty: dto.specialty,
        experienceYears: dto.experienceYears !== undefined ? Number(dto.experienceYears) : undefined,
        bio: dto.bio,
        isActive: dto.isActive,
      };

      if (dto.firstName || dto.lastName || dto.phone || dto.password || dto.name) {
        const userUpdate: Prisma.UserUpdateInput = {};
        if (dto.name) {
          userUpdate.name = dto.name;
        } else if (dto.firstName || dto.lastName) {
          const currentNameParts = (doctor.user?.name || '').split(' ');
          const fName = dto.firstName || currentNameParts[0] || '';
          const lName = dto.lastName || currentNameParts.slice(1).join(' ') || '';
          userUpdate.name = `${fName} ${lName}`.trim();
        }
        
        if (dto.phone) userUpdate.phone = dto.phone.replace(/\D/g, '');
        if (dto.password) userUpdate.passwordHash = await bcrypt.hash(dto.password, 10);

        await tx.user.update({
          where: { id: doctor.userId },
          data: userUpdate,
        });
      }

      if (dto.availabilities) {
        updateData.availabilities = {
          deleteMany: {},
          create: dto.availabilities.map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            slotDuration: a.slotDuration || 30,
          }))
        };
      }

      const updated = await tx.doctor.update({
        where: { id },
        data: updateData,
        include: { user: true, availabilities: true },
      });

      return this.toResponse(updated);
    });
  }

  async remove(id: string) {
    const doctor = await this.doctorsRepository.findById(id);
    if (!doctor) throw new NotFoundException('Shifokor topilmadi');

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.userId },
        data: { isActive: false, deletedAt: new Date() },
      });

      await tx.doctor.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      return { id };
    });
  }

  private toResponse(d: any): DoctorResponse {
    const rawAvailabilities = d.availabilities || [];
    
    return {
      id: d.id,
      userId: d.userId,
      specialty: d.specialty,
      experienceYears: d.experienceYears,
      bio: d.bio,
      isActive: d.isActive,
      name: d.user?.name || 'Noma\'lum',
      phone: d.user?.phone,
      email: d.user?.email,
      avatar: d.user?.avatar,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      availabilities: rawAvailabilities,
      schedule: rawAvailabilities.map((a: any) => ({
        day: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isWorking: true,
      })),
    };
  }
}
