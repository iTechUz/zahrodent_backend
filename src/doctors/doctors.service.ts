import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DoctorsRepository, DoctorWithUser } from './doctors.repository';
import { UsersService } from '../users/users.service';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { DoctorsQueryDto } from './dto/doctors-query.dto';

export const DOCTOR_NOT_FOUND = 'Shifokor topilmadi';
export const DOCTOR_HAS_HISTORY =
  "Shifokorni o'chirib bo'lmaydi: unga bog'langan qabullar yoki tashriflar mavjud";
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorsRepository: DoctorsRepository,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    query: DoctorsQueryDto,
  ): Promise<PaginatedResponse<ReturnType<DoctorsService['toResponse']>>> {
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
      ...orderByOption<Prisma.DoctorOrderByWithRelationInput[]>(
        query,
        'firstName',
      ),
    });
    return { data: data.map((d) => this.toResponse(d)), total };
  }

  async findOne(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException(DOCTOR_NOT_FOUND);
    return this.toResponse(d);
  }

  async create(dto: CreateDoctorDto) {
    const user = dto.password
      ? await this.usersService.buildCreateData({
          name: `${dto.firstName} ${dto.lastName}`,
          phone: dto.phone,
          password: dto.password,
          role: 'doctor',
          specialty: dto.specialty,
          avatar: dto.avatar,
        })
      : null;

    const d = await this.doctorsRepository.createWithUser(
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        specialty: dto.specialty,
        phone: dto.phone,
        avatar: dto.avatar,
        schedule: dto.schedule as unknown as Prisma.InputJsonValue,
        daysOff: dto.daysOff as unknown as Prisma.InputJsonValue,
      },
      user,
    );
    return this.toResponse(d);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const existingDoctor = await this.doctorsRepository.findById(id);
    if (!existingDoctor) throw new NotFoundException(DOCTOR_NOT_FOUND);

    let userOp: Parameters<DoctorsRepository['updateWithUser']>[2] = null;

    // Login credentials are (re)written only when a password is given.
    if (dto.password) {
      if (existingDoctor.userId) {
        userOp = {
          update: {
            id: existingDoctor.userId,
            data: await this.usersService.buildUpdateData(
              existingDoctor.userId,
              {
                name:
                  dto.firstName && dto.lastName
                    ? `${dto.firstName} ${dto.lastName}`
                    : existingDoctor.firstName + ' ' + existingDoctor.lastName,
                phone: dto.phone || existingDoctor.phone,
                password: dto.password,
                specialty: dto.specialty,
                avatar: dto.avatar,
              },
            ),
          },
        };
      } else {
        userOp = {
          create: await this.usersService.buildCreateData({
            name: `${dto.firstName || existingDoctor.firstName} ${
              dto.lastName || existingDoctor.lastName
            }`,
            phone: dto.phone || existingDoctor.phone,
            password: dto.password,
            role: 'doctor',
            specialty: dto.specialty || existingDoctor.specialty,
            avatar: dto.avatar || existingDoctor.avatar || undefined,
          }),
        };
      }
    }

    const d = await this.doctorsRepository.updateWithUser(
      id,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        specialty: dto.specialty,
        phone: dto.phone,
        avatar: dto.avatar,
        schedule: dto.schedule as unknown as Prisma.InputJsonValue,
        daysOff: dto.daysOff as unknown as Prisma.InputJsonValue,
      },
      userOp,
    );
    // Login password rewritten → the doctor's sessions must log in again.
    if (userOp && 'update' in userOp) {
      await this.usersService.revokeSessions(userOp.update.id);
    }
    return this.toResponse(d);
  }

  async remove(id: string) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException(DOCTOR_NOT_FOUND);

    const history = await this.doctorsRepository.countHistory(id);
    if (history.bookings > 0 || history.visits > 0) {
      throw new ConflictException(DOCTOR_HAS_HISTORY);
    }

    try {
      await this.doctorsRepository.deleteWithUser(id, d.userId ?? null);
    } catch (e) {
      // A booking/visit created between the check and the delete.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(DOCTOR_HAS_HISTORY);
      }
      throw e;
    }
    return { id };
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

  private toResponse(d: DoctorWithUser) {
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
