import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  dateOnlyColumnRange,
  toDateOnlyString,
} from '../common/utils/date.util';
import {
  DEFAULT_DURATION_MIN,
  scheduleViolation,
  timeToMinutes,
} from '../bookings/schedule-conflict';
import { Prisma } from '@prisma/client';
import { DoctorsRepository, DoctorWithUser } from './doctors.repository';
import { PHONE_TAKEN_MESSAGE, UsersService } from '../users/users.service';
import { AuthUserView } from '../auth/auth.service';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { DoctorsQueryDto } from './dto/doctors-query.dto';

export const DOCTOR_NOT_FOUND = 'Shifokor topilmadi';
export const DOCTOR_HAS_HISTORY =
  "Shifokorni o'chirib bo'lmaydi: unga bog'langan qabullar yoki tashriflar mavjud";
export const LOGIN_NEEDS_PASSWORD =
  "Login telefonini o'zgartirish uchun shifokorning login hisobi bo'lishi kerak — avval parol bering";
export const BREAK_PAIR_MESSAGE =
  "Tanaffus uchun breakStart va breakEnd ikkalasi birga berilishi va breakStart < breakEnd bo'lishi kerak";
export const BREAK_OUTSIDE_MESSAGE =
  "Tanaffus ish vaqti (startTime–endTime) ichida bo'lishi kerak";
import { CreateDoctorDto, ScheduleSlotDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

/** undefined → o'zgarmaydi; null → tozalanadi (Prisma JSON null). */
const jsonField = (v: unknown) =>
  v === undefined
    ? undefined
    : v === null
      ? Prisma.JsonNull
      : (v as Prisma.InputJsonValue);

/** Tanaffus: ikkalasi birga, boshi < oxiri, ish vaqti ichida. */
function assertScheduleBreaks(schedule: ScheduleSlotDto[] | null | undefined) {
  for (const slot of schedule ?? []) {
    const { breakStart, breakEnd } = slot;
    if (!breakStart && !breakEnd) continue;
    if (!breakStart || !breakEnd)
      throw new BadRequestException(BREAK_PAIR_MESSAGE);
    const bs = timeToMinutes(breakStart.slice(0, 5));
    const be = timeToMinutes(breakEnd.slice(0, 5));
    if (bs >= be) throw new BadRequestException(BREAK_PAIR_MESSAGE);
    if (
      slot.isWorking &&
      (bs < timeToMinutes(slot.startTime.slice(0, 5)) ||
        be > timeToMinutes(slot.endTime.slice(0, 5)))
    ) {
      throw new BadRequestException(BREAK_OUTSIDE_MESSAGE);
    }
  }
}

/** Poyga: telefon tekshiruvidan keyin band bo'lgan raqam (P2002) → 409. */
const rethrowUnique = (e: unknown): never => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new ConflictException(PHONE_TAKEN_MESSAGE);
  }
  throw e;
};

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorsRepository: DoctorsRepository,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    query: DoctorsQueryDto,
    user?: AuthUserView,
  ): Promise<PaginatedResponse<ReturnType<DoctorsService['toResponse']>>> {
    const { search, specialty } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.DoctorWhereInput = {};

    // Nofaol shifokorlar faqat admin boshqaruv sahifasi uchun (includeInactive).
    if (!(query.includeInactive === 'true' && user?.role !== 'doctor')) {
      where.isActive = true;
    }

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
    return { data: data.map((d) => this.toResponse(d, user)), total };
  }

  async findOne(id: string, user?: AuthUserView) {
    const d = await this.doctorsRepository.findById(id);
    if (!d) throw new NotFoundException(DOCTOR_NOT_FOUND);
    return this.toResponse(d, user);
  }

  async create(dto: CreateDoctorDto) {
    assertScheduleBreaks(dto.schedule);
    const user = dto.password
      ? await this.usersService.buildCreateData({
          name: `${dto.firstName} ${dto.lastName}`,
          phone: dto.loginPhone ?? dto.phone,
          password: dto.password,
          role: 'doctor',
          specialty: dto.specialty,
          avatar: dto.avatar,
        })
      : null;

    const d = await this.doctorsRepository
      .createWithUser(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          specialty: dto.specialty,
          phone: dto.phone,
          avatar: dto.avatar,
          schedule: jsonField(dto.schedule),
          daysOff: jsonField(dto.daysOff),
        },
        user,
      )
      .catch(rethrowUnique);
    return this.toResponse(d);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const existingDoctor = await this.doctorsRepository.findById(id);
    if (!existingDoctor) throw new NotFoundException(DOCTOR_NOT_FOUND);
    assertScheduleBreaks(dto.schedule);

    let userOp: Parameters<DoctorsRepository['updateWithUser']>[2] = null;
    // Ism faqat ikkala qismi ham berilganda yangilanadi.
    const bothNames = dto.firstName && dto.lastName;

    if (dto.password) {
      // Login credentials are (re)written only when a password is given.
      if (existingDoctor.userId) {
        userOp = {
          update: {
            id: existingDoctor.userId,
            data: await this.usersService.buildUpdateData(
              existingDoctor.userId,
              {
                name: bothNames
                  ? `${dto.firstName} ${dto.lastName}`
                  : undefined,
                // Login telefoni (Doctor.phone — aloqa raqami) faqat aniq
                // yuborilganda o'zgaradi.
                phone: dto.loginPhone,
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
            phone: dto.loginPhone || dto.phone || existingDoctor.phone,
            password: dto.password,
            role: 'doctor',
            specialty: dto.specialty || existingDoctor.specialty,
            avatar: dto.avatar || existingDoctor.avatar || undefined,
          }),
        };
      }
    } else if (dto.loginPhone) {
      // Parolsiz ham login telefonini almashtirish mumkin (login bor bo'lsa).
      if (!existingDoctor.userId) {
        throw new BadRequestException(LOGIN_NEEDS_PASSWORD);
      }
      userOp = {
        update: {
          id: existingDoctor.userId,
          data: await this.usersService.buildUpdateData(existingDoctor.userId, {
            phone: dto.loginPhone,
          }),
        },
      };
    }

    const d = await this.doctorsRepository
      .updateWithUser(
        id,
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          specialty: dto.specialty,
          phone: dto.phone,
          avatar: dto.avatar,
          schedule: jsonField(dto.schedule),
          daysOff: jsonField(dto.daysOff),
          isActive: dto.isActive,
        },
        userOp,
        dto.isActive,
      )
      .catch(rethrowUnique);
    // Login password rewritten or doctor deactivated → sessions must end.
    if (existingDoctor.userId && (dto.isActive === false || dto.password)) {
      await this.usersService.revokeSessions(existingDoctor.userId);
    }
    if (dto.schedule === undefined && dto.daysOff === undefined) {
      return this.toResponse(d);
    }
    // Existing bookings are not cancelled — just reported to the admin.
    return {
      ...this.toResponse(d),
      scheduleConflicts: await this.countScheduleConflicts(d),
    };
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
    // Nofaol shifokorlar jami songa kirmaydi.
    const total = await this.doctorsRepository.count({ isActive: true });

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

  async getEfficiency(period: { startDate?: string; endDate?: string } = {}) {
    const rawStats = await this.doctorsRepository.getDetailedEfficiencyStats(
      dateOnlyColumnRange(period.startDate, period.endDate),
    );

    return (
      rawStats
        // Nofaol shifokor: tarix (davrda qabul/tashrif bor) qoladi, bo'sh karta yo'q.
        .filter((s) => s.isActive || s.totalBookings > 0 || s.totalVisits > 0)
        .map((s) => {
          // Completed bookings / non-cancelled bookings (arrived and no-show stay
          // in the denominator), capped at 100.
          const conversionRate =
            s.totalBookings > 0
              ? Math.min(
                  100,
                  Math.round((s.completedBookings / s.totalBookings) * 100),
                )
              : 0;

          const avgCheck =
            s.totalVisits > 0 ? Math.round(s.totalRevenue / s.totalVisits) : 0;

          return {
            ...s,
            conversionRate,
            avgCheck,
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
    ); // Sort by revenue by default
  }

  /** Active future bookings that no longer fit the doctor's schedule/days off. */
  private async countScheduleConflicts(d: DoctorWithUser): Promise<number> {
    try {
      const rows = await this.doctorsRepository.findActiveFutureBookings(d.id);
      return rows.filter(
        (b) =>
          scheduleViolation(
            d,
            toDateOnlyString(b.date),
            b.time,
            b.service?.duration || DEFAULT_DURATION_MIN,
          ) !== null,
      ).length;
    } catch {
      return 0;
    }
  }

  /** Doctor roli boshqa shifokorlarning telefonini ko'rmaydi (o'zinikini ko'radi). */
  private toResponse(d: DoctorWithUser, viewer?: AuthUserView) {
    const hidePhone = viewer?.role === 'doctor' && viewer.doctorId !== d.id;
    return {
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty,
      phone: hidePhone ? undefined : d.phone,
      loginPhone: hidePhone ? undefined : d.user?.phone,
      isActive: d.isActive,
      avatar: d.avatar ?? undefined,
      schedule: d.schedule ?? undefined,
      daysOff: (d.daysOff as string[] | null) ?? undefined,
    };
  }
}
