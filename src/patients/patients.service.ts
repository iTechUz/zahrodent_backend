import {
  ConflictException,
  Injectable,
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
import { computePatientBalance } from './patient-balance';

export const PATIENT_NOT_FOUND = 'Bemor topilmadi';
export const PATIENT_HAS_HISTORY =
  "Bemorni o'chirib bo'lmaydi: unga bog'langan tashriflar yoki to'lovlar mavjud";

@Injectable()
export class PatientsService {
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

    const and: Prisma.PatientWhereInput[] = [];

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
      and.push({
        OR: [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    if (debtOnly === 'true') {
      const debtors = await this.patientsRepository.findDebtors();
      if (!debtors.length) return { data: [], total: 0 };
      and.push({ id: { in: debtors.map((d) => d.id) } });
    }

    const where: Prisma.PatientWhereInput = and.length ? { AND: and } : {};

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

  async findOne(id: string, user: AuthUserView) {
    const scope = this.scopeWhere(user);
    const p = await this.patientsRepository.findById(id);
    if (!p) throw new NotFoundException(PATIENT_NOT_FOUND);

    if (scope) {
      const hasAccess = await this.patientsRepository.count({
        AND: [{ id }, scope],
      });
      // Same 404 as "missing" so a doctor can't probe other patients' ids.
      if (!hasAccess) throw new NotFoundException(PATIENT_NOT_FOUND);
    }
    return this.toResponse(p);
  }

  async create(dto: CreatePatientDto) {
    const p = await this.patientsRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      phone: dto.phone,
      source: dto.source,
      notes: dto.notes ?? '',
      address: dto.address,
      workplace: dto.workplace,
      assignedDoctor: dto.assignedDoctorId
        ? { connect: { id: dto.assignedDoctorId } }
        : undefined,
      avatar: dto.avatar,
      toothChart:
        dto.toothChart === undefined ? undefined : (dto.toothChart as object),
      // DATE column: use the clinic's calendar day, not the DB server's TZ.
      createdAt: parseDateOnlyToUTC(todayInTashkent()),
    });
    return this.toResponse(p);
  }

  async update(id: string, dto: UpdatePatientDto, user: AuthUserView) {
    await this.ensureExists(id, user);
    const p = await this.patientsRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      phone: dto.phone,
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
    return this.toResponse(p);
  }

  async remove(id: string, user: AuthUserView) {
    await this.ensureExists(id, user);
    // visits/payments cascade on delete — refuse instead of wiping history.
    const history = await this.patientsRepository.countHistory(id);
    if (history.visits > 0 || history.payments > 0) {
      throw new ConflictException(PATIENT_HAS_HISTORY);
    }
    await this.patientsRepository.delete(id);
    return { id };
  }

  private async ensureExists(id: string, user: AuthUserView) {
    await this.findOne(id, user);
  }

  async getStats(user: AuthUserView) {
    const scope = this.scopeWhere(user);
    const where: Prisma.PatientWhereInput = scope ?? {};

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
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      phone: p.phone,
      source: p.source,
      notes: p.notes,
      address: p.address,
      workplace: p.workplace,
      avatar: p.avatar ?? undefined,
      balance: computePatientBalance(p),
      createdAt: toDateOnlyString(p.createdAt),
      assignedDoctorId: p.assignedDoctorId ?? null,
      assignedDoctor: p.assignedDoctor
        ? {
            firstName: p.assignedDoctor.firstName,
            lastName: p.assignedDoctor.lastName,
          }
        : undefined,
      toothChart: (p.toothChart as Record<number, unknown> | null) ?? undefined,
    };
  }
}
