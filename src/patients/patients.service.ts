import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PatientsRepository,
  PatientWithRelations,
} from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsQueryDto } from './dto/patients-query.dto';
import {
  dateOnlyColumnRange,
  monthBoundsOf,
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { AuthUserView } from '../auth/auth.service';
import {
  doctorPatientsWhere,
  doctorScopeId,
} from '../common/auth/doctor-scope';
import { computePatientFinance } from './patient-balance';
import {
  AGE_OR_BIRTH_YEAR_REQUIRED,
  displayAge,
  resolveAgeFields,
} from './patient-age';
import { normalizeUzPhone } from '../common/utils/phone.util';
import { ACTIVE_BOOKING_STATUSES } from '../bookings/bookings.service';

export const PATIENT_NOT_FOUND = 'Bemor topilmadi';

/** Soft-deleted patients are hidden from every list, stat and lookup. */
export const NOT_DELETED: Prisma.PatientWhereInput = { deletedAt: null };

/** Search strings made only of phone characters are matched by digits. */
const PHONE_LIKE = /^[\d\s+()-]+$/;
const MIN_PHONE_SEARCH_DIGITS = 3;

const currentYear = () => Number(todayInTashkent().slice(0, 4));

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(private readonly patientsRepository: PatientsRepository) {}

  /** Doctor → only own patients; other roles → no restriction. */
  private scopeWhere(user: AuthUserView): Prisma.PatientWhereInput | null {
    const doctorId = doctorScopeId(user);
    return doctorId ? doctorPatientsWhere(doctorId) : null;
  }

  async findAll(
    query: PatientsQueryDto,
    user: AuthUserView,
  ): Promise<PaginatedResponse<ReturnType<PatientsService['toResponse']>>> {
    const { search, source, startDate, endDate, debtOnly, doctorId } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const and: Prisma.PatientWhereInput[] = [NOT_DELETED];

    const scope = this.scopeWhere(user);
    if (scope) and.push(scope);

    if (source && source !== 'all') and.push({ source });
    if (doctorId) and.push({ assignedDoctorId: doctorId });

    if (startDate || endDate) {
      // created_at is a DATE column → compare calendar days directly.
      and.push({ createdAt: dateOnlyColumnRange(startDate, endDate) });
    }

    const s = search?.trim();
    if (s) {
      // "ali val" → every word must hit the first or the last name (AND);
      // a phone-like query also matches phones by digits (any formatting).
      const nameMatch: Prisma.PatientWhereInput = {
        AND: s.split(/\s+/).map((token) => ({
          OR: [
            { firstName: { contains: token, mode: 'insensitive' } },
            { lastName: { contains: token, mode: 'insensitive' } },
          ],
        })),
      };
      const digits = s.replace(/\D/g, '');
      const phoneIds =
        PHONE_LIKE.test(s) && digits.length >= MIN_PHONE_SEARCH_DIGITS
          ? await this.patientsRepository.findActiveIdsByPhoneDigits(digits)
          : [];
      and.push(
        phoneIds.length
          ? { OR: [nameMatch, { id: { in: phoneIds.map((r) => r.id) } }] }
          : nameMatch,
      );
    }

    if (debtOnly === 'true') {
      const debtors = await this.patientsRepository.findDebtors();
      if (!debtors.length) return { data: [], total: 0 };
      and.push({ id: { in: debtors.map((d) => d.id) } });
    }

    const where: Prisma.PatientWhereInput = { AND: and };

    const { data, total } = await this.patientsRepository.findAll(where, {
      skip,
      take: limitNum,
      ...orderByOption<Prisma.PatientOrderByWithRelationInput[]>(
        query,
        'createdAt',
      ),
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  /**
   * A soft-deleted patient is 404 unless an admin asks for it explicitly
   * (`includeDeleted`).
   */
  async findOne(
    id: string,
    user: AuthUserView,
    opts: { includeDeleted?: boolean } = {},
  ) {
    const scope = this.scopeWhere(user);
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException(PATIENT_NOT_FOUND);
    if (p.deletedAt && !(opts.includeDeleted && user.role === 'admin')) {
      throw new NotFoundException(PATIENT_NOT_FOUND);
    }

    if (scope) {
      const hasAccess = await this.patientsRepository.count({
        AND: [{ id }, scope],
      });
      // Same 404 as "missing" so a doctor can't probe other patients' ids.
      if (!hasAccess) throw new NotFoundException(PATIENT_NOT_FOUND);
    }
    return this.toResponse(p);
  }

  /**
   * Same phone on another live patient → warn, never block (siblings/parents
   * legitimately share a number). Returns the other patients' ids.
   */
  private async findDuplicatePhone(
    phone: string,
    exceptId?: string,
  ): Promise<string[]> {
    if (!normalizeUzPhone(phone)) return [];
    const rows = await this.patientsRepository.findActiveIdsByMobile(phone);
    const ids = rows.map((r) => r.id).filter((id) => id !== exceptId);
    if (ids.length) {
      this.logger.warn(
        `Telefon ${phone} boshqa ${ids.length} ta bemorda ham bor (${ids.join(', ')})`,
      );
    }
    return ids;
  }

  async create(dto: CreatePatientDto) {
    const ageFields = resolveAgeFields(dto, currentYear());
    if (!ageFields) throw new BadRequestException(AGE_OR_BIRTH_YEAR_REQUIRED);
    // Canonical +998XXXXXXXXX when it is an Uzbek number.
    const phone = normalizeUzPhone(dto.phone) ?? dto.phone.trim();
    const duplicates = await this.findDuplicatePhone(phone);
    const p = await this.patientsRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: ageFields.age,
      birthYear: ageFields.birthYear,
      phone,
      source: dto.source ?? 'walk-in',
      notes: dto.notes ?? '',
      address: dto.address ?? '',
      workplace: dto.workplace ?? '',
      assignedDoctor: dto.assignedDoctorId
        ? { connect: { id: dto.assignedDoctorId } }
        : undefined,
      avatar: dto.avatar,
      toothChart:
        dto.toothChart === undefined ? undefined : (dto.toothChart as object),
      // DATE column: use the clinic's calendar day, not the DB server's TZ.
      createdAt: parseDateOnlyToUTC(todayInTashkent()),
    });
    return this.withDuplicatePhone(this.toResponse(p), duplicates);
  }

  private withDuplicatePhone<T extends object>(res: T, ids: string[]) {
    return ids.length
      ? { ...res, duplicatePhone: { count: ids.length, patientIds: ids } }
      : res;
  }

  async update(id: string, dto: UpdatePatientDto, user: AuthUserView) {
    await this.ensureExists(id, user);
    const ageFields = resolveAgeFields(dto, currentYear());
    const phone =
      dto.phone === undefined
        ? undefined
        : (normalizeUzPhone(dto.phone) ?? dto.phone.trim());
    const duplicates =
      phone === undefined ? [] : await this.findDuplicatePhone(phone, id);
    const p = await this.patientsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: ageFields?.age,
      birthYear: ageFields?.birthYear,
      phone,
      source: dto.source,
      notes: dto.notes,
      address: dto.address,
      workplace: dto.workplace,
      assignedDoctor:
        dto.assignedDoctorId === null
          ? { disconnect: true }
          : dto.assignedDoctorId
            ? { connect: { id: dto.assignedDoctorId } }
            : undefined,
      avatar: dto.avatar,
      toothChart:
        dto.toothChart === undefined ? undefined : (dto.toothChart as object),
    });
    // Other patients' ids are not shown to doctors (they only see own patients).
    return this.withDuplicatePhone(
      this.toResponse(p),
      user.role === 'doctor' ? [] : duplicates,
    );
  }

  /**
   * Soft delete (admin). History stays; upcoming pending/confirmed bookings
   * (today onwards, Asia/Tashkent) are cancelled. Already deleted → 404.
   */
  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    await this.patientsRepository.softDelete(
      id,
      new Date(),
      parseDateOnlyToUTC(todayInTashkent()),
      ACTIVE_BOOKING_STATUSES,
    );
    return { id };
  }

  /** Undo a soft delete (admin). Cancelled bookings stay cancelled. */
  async restore(id: string) {
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException(PATIENT_NOT_FOUND);
    if (!p.deletedAt) return this.toResponse(p);
    return this.toResponse(await this.patientsRepository.restore(id));
  }

  private async ensureExists(id: string, user: AuthUserView) {
    await this.findOne(id, user);
  }

  async getStats(user: AuthUserView) {
    const scope = this.scopeWhere(user);
    const where: Prisma.PatientWhereInput = scope
      ? { AND: [NOT_DELETED, scope] }
      : NOT_DELETED;

    const month = monthBoundsOf(todayInTashkent());

    const [total, newThisMonth, sources] = await Promise.all([
      this.patientsRepository.count(where),
      this.patientsRepository.count({
        AND: [where, { createdAt: { gte: parseDateOnlyToUTC(month.start) } }],
      }),
      this.patientsRepository.groupBySource(where),
    ]);

    return {
      total,
      newThisMonth,
      topSource: sources[0]?.source || 'N/A',
    };
  }

  // Comments
  async addComment(
    data: { content: string; patientId: string },
    user: AuthUserView,
  ) {
    await this.ensureExists(data.patientId, user);
    return this.patientsRepository.createComment({
      content: data.content,
      patientId: data.patientId,
      authorId: user.id,
    });
  }

  async findComments(patientId: string, user: AuthUserView) {
    await this.ensureExists(patientId, user);
    return this.patientsRepository.findCommentsByPatientId(patientId);
  }

  toResponse(p: PatientWithRelations) {
    const finance = computePatientFinance(p);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: displayAge(p, currentYear()),
      birthYear: p.birthYear ?? null,
      phone: p.phone,
      source: p.source,
      notes: p.notes,
      address: p.address,
      workplace: p.workplace,
      avatar: p.avatar ?? undefined,
      balance: finance.balance,
      // INCOME only (gross received); refunds (EXPENSE) are separate.
      totalPaid: finance.totalPaid,
      totalRefunded: finance.totalRefunded,
      totalOwed: finance.totalOwed,
      createdAt: toDateOnlyString(p.createdAt),
      assignedDoctorId: p.assignedDoctorId ?? null,
      assignedDoctor: p.assignedDoctor
        ? {
            firstName: p.assignedDoctor.firstName,
            lastName: p.assignedDoctor.lastName,
          }
        : undefined,
      toothChart: (p.toothChart as Record<number, unknown> | null) ?? undefined,
      telegramConnected: Boolean(p.telegramChatId),
      deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
    };
  }
}
