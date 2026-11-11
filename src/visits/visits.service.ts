import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VisitsRepository, VisitWithPatient } from './visits.repository';
import {
  connectActivePatient,
  toPatientSummary,
} from '../patients/patient-summary';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { VisitsQueryDto } from './dto/visits-query.dto';
import {
  doctorPatientsWhere,
  doctorScopeId,
} from '../common/auth/doctor-scope';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import {
  dateOnlyColumnRange,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';

export const VISIT_NOT_FOUND = 'Tashrif topilmadi';
export const PATIENT_NOT_FOUND = 'Bemor topilmadi';
export const BOOKING_NOT_FOUND = 'Qabul topilmadi';
export const VISIT_ALREADY_EXISTS = 'Bu qabul uchun tashrif allaqachon mavjud';
export const VISIT_PRICE_ADMIN_ONLY =
  "Tashrif narxini faqat administrator o'zgartira oladi";
export const VISIT_COMPLETED_IN_FUTURE =
  "Kelajakdagi sanali tashrifni yakunlangan deb belgilab bo'lmaydi";
export const VISIT_PATIENT_IMMUTABLE =
  "Tashrifning bemorini o'zgartirib bo'lmaydi (to'lovlar shu bemorga bog'langan) — yangi tashrif yarating";
export const BOOKING_OTHER_PATIENT =
  'Qabul boshqa bemorga tegishli — tashrifni unga bog‘lab bo‘lmaydi';
import { AuthUserView } from '../auth/auth.service';

@Injectable()
export class VisitsService {
  constructor(private readonly visitsRepository: VisitsRepository) {}

  async findAll(
    query: VisitsQueryDto,
    user: AuthUserView,
  ): Promise<PaginatedResponse<ReturnType<VisitsService['toResponse']>>> {
    const { search, patientId, doctorId, status, startDate, endDate } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.VisitWhereInput = {};

    if (patientId) where.patientId = patientId;

    const scopedDoctorId = doctorScopeId(user);
    if (scopedDoctorId) {
      where.doctorId = scopedDoctorId;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (status && status !== 'all') where.status = status;
    if (startDate || endDate) {
      where.date = dateOnlyColumnRange(startDate, endDate);
    }

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { diagnosis: { contains: s, mode: 'insensitive' } },
        { treatment: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await this.visitsRepository.findAll(where, {
      skip,
      take: limitNum,
      ...orderByOption<Prisma.VisitOrderByWithRelationInput[]>(query, 'date'),
    });
    return { data: data.map((v) => this.toResponse(v)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    const v = await this.getAccessible(id, user);
    return this.toResponse(v);
  }

  /** A doctor always records visits under their own Doctor id. */
  async create(dto: CreateVisitDto, user: AuthUserView) {
    const scopedDoctorId = doctorScopeId(user);
    const doctorId = scopedDoctorId ?? dto.doctorId;
    const dateStr = dto.date ?? todayInTashkent();
    if (scopedDoctorId)
      await this.assertPatientInScope(dto.patientId, scopedDoctorId);
    if (dto.bookingId) {
      await this.assertBookingBelongs(
        dto.bookingId,
        dto.patientId,
        scopedDoctorId,
      );
    }
    this.assertNotFutureCompleted(dto.status, dateStr);
    const data: Prisma.VisitCreateInput = {
      patient: connectActivePatient(dto.patientId),
      doctor: { connect: { id: doctorId } },
      booking: dto.bookingId ? { connect: { id: dto.bookingId } } : undefined,
      date: parseDateOnlyToUTC(dateStr),
      status: dto.status,
      diagnosis: dto.diagnosis ?? '',
      treatment: dto.treatment ?? '',
      notes: dto.notes ?? '',
      price: dto.price ?? 0,
    };
    // A booking gets ONE visit: completing it already auto-creates one, a
    // second would bill the patient twice. Checked under a per-booking lock.
    const v = dto.bookingId
      ? await this.visitsRepository.createForBooking(dto.bookingId, data)
      : await this.visitsRepository.create(data);
    if (!v) throw new ConflictException(VISIT_ALREADY_EXISTS);
    return this.toResponse(v);
  }

  async update(id: string, dto: UpdateVisitDto, user: AuthUserView) {
    const current = await this.getAccessible(id, user);
    const scopedDoctorId = doctorScopeId(user);
    // Payments (and balance) hang off the visit's patient: never re-parent.
    if (dto.patientId !== undefined && dto.patientId !== current.patientId) {
      throw new BadRequestException(VISIT_PATIENT_IMMUTABLE);
    }
    if (dto.bookingId) {
      await this.assertBookingBelongs(
        dto.bookingId,
        current.patientId,
        scopedDoctorId,
      );
    }
    // The price decides the patient's debt: only an admin may change it
    // (re-sending the same value is fine).
    if (
      dto.price !== undefined &&
      dto.price !== (current.price || 0) &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException(VISIT_PRICE_ADMIN_ONLY);
    }
    this.assertNotFutureCompleted(
      dto.status ?? current.status,
      dto.date ?? toDateOnlyString(current.date),
    );
    // A doctor can't hand a visit over to another doctor.
    const doctorId = scopedDoctorId ? undefined : dto.doctorId;
    const data: Prisma.VisitUpdateInput = {
      date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
      status: dto.status,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      notes: dto.notes,
      price: dto.price,
      doctor:
        doctorId === undefined ? undefined : { connect: { id: doctorId } },
      booking:
        dto.bookingId === undefined
          ? undefined
          : dto.bookingId
            ? { connect: { id: dto.bookingId } }
            : { disconnect: true },
    };
    const relinked = dto.bookingId && dto.bookingId !== current.bookingId;
    const v = relinked
      ? await this.visitsRepository.updateLinkingBooking(
          id,
          dto.bookingId as string,
          data,
        )
      : await this.visitsRepository.update(id, data);
    if (!v) throw new ConflictException(VISIT_ALREADY_EXISTS);
    return this.toResponse(v);
  }

  /** A visit that hasn't happened yet can't be "completed" (it would bill the patient). */
  private assertNotFutureCompleted(status: string, dateStr: string) {
    if (status === 'completed' && dateStr > todayInTashkent()) {
      throw new BadRequestException(VISIT_COMPLETED_IN_FUTURE);
    }
  }

  /** A doctor only records visits for patients in their own scope. */
  private async assertPatientInScope(patientId: string, doctorId: string) {
    const ok = await this.visitsRepository.patientInScope(
      patientId,
      doctorPatientsWhere(doctorId),
    );
    // Same 404 as "missing" so ids of other patients can't be probed.
    if (!ok) throw new NotFoundException(PATIENT_NOT_FOUND);
  }

  private async assertBookingBelongs(
    bookingId: string,
    patientId: string,
    scopedDoctorId: string | null,
  ) {
    const booking = await this.visitsRepository.findBookingOwner(bookingId);
    if (!booking) throw new NotFoundException(BOOKING_NOT_FOUND);
    if (booking.patientId !== patientId) {
      throw new BadRequestException(BOOKING_OTHER_PATIENT);
    }
    if (scopedDoctorId && booking.doctorId !== scopedDoctorId) {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
  }

  private async getAccessible(id: string, user: AuthUserView) {
    const scopedDoctorId = doctorScopeId(user);
    const v = await this.visitsRepository.findById(id);
    if (!v) throw new NotFoundException(VISIT_NOT_FOUND);
    if (scopedDoctorId && v.doctorId !== scopedDoctorId) {
      throw new NotFoundException(VISIT_NOT_FOUND);
    }
    return v;
  }

  private toResponse(v: VisitWithPatient) {
    return {
      id: v.id,
      patientId: v.patientId,
      doctorId: v.doctorId,
      bookingId: v.bookingId ?? undefined,
      date: toDateOnlyString(v.date),
      status: v.status,
      diagnosis: v.diagnosis,
      treatment: v.treatment,
      notes: v.notes,
      price: v.price || 0,
      patient: toPatientSummary(v.patient),
    };
  }
}
