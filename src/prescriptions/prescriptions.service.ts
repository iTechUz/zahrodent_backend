import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUserView } from '../auth/auth.service';
import {
  doctorPatientsWhere,
  doctorScopeId,
} from '../common/auth/doctor-scope';
import { orderByOption } from '../common/dto/pagination.dto';
import {
  parseDateOnlyToUTC,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionsQueryDto } from './dto/prescriptions-query.dto';
import {
  PrescriptionRow,
  PrescriptionsRepository,
} from './prescriptions.repository';

export const PRESCRIPTION_NOT_FOUND = 'Retsept topilmadi';
export const PATIENT_NOT_AVAILABLE = 'Bemor topilmadi';
export const PRESCRIPTION_NOT_ACTIVE =
  'Retsept faol emas (allaqachon berilgan yoki bekor qilingan)';
export const PRESCRIPTION_EXPIRED = 'Retsept muddati o‘tgan';

// No 0/O/1/I/L so a code read over the phone or from paper isn't ambiguous.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DEFAULT_VALID_DAYS = 30;

export function generatePrescriptionCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class PrescriptionsService {
  constructor(private readonly repo: PrescriptionsRepository) {}

  async create(dto: CreatePrescriptionDto, user: AuthUserView) {
    const doctorId = doctorScopeId(user) ?? dto.doctorId;
    if (!doctorId) throw new BadRequestException('doctorId majburiy');

    const patientWhere: Prisma.PatientWhereInput = {
      id: dto.patientId,
      deletedAt: null,
      // A doctor may only prescribe to their own patients.
      ...(user.role === 'doctor' ? doctorPatientsWhere(doctorId) : {}),
    };
    if (!(await this.repo.countPatients(patientWhere))) {
      throw new NotFoundException(PATIENT_NOT_AVAILABLE);
    }
    if (dto.visitId) {
      const ok = await this.repo.countVisits({
        id: dto.visitId,
        patientId: dto.patientId,
        doctorId,
      });
      if (!ok) throw new BadRequestException('Tashrif topilmadi');
    }

    const validUntil = addDays(
      parseDateOnlyToUTC(todayInTashkent()),
      dto.validDays ?? DEFAULT_VALID_DAYS,
    );

    // The unique index is the source of truth; retry on the (very rare) clash.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await this.repo.create({
          code: generatePrescriptionCode(),
          patient: { connect: { id: dto.patientId } },
          doctor: { connect: { id: doctorId } },
          visit: dto.visitId ? { connect: { id: dto.visitId } } : undefined,
          notes: dto.notes ?? '',
          validUntil,
          items: {
            create: dto.items.map((i) => ({
              name: i.name.trim(),
              dosage: i.dosage ?? '',
              frequency: i.frequency ?? '',
              duration: i.duration ?? '',
              quantity: i.quantity ?? '',
              instructions: i.instructions ?? '',
            })),
          },
        });
        return this.toResponse(row);
      } catch (e) {
        const clash =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (!clash) throw e;
      }
    }
    throw new ConflictException(
      'Retsept kodini yaratib bo‘lmadi, qayta urining',
    );
  }

  async findAll(query: PrescriptionsQueryDto, user: AuthUserView) {
    const pageNum = Number(query.page || 0);
    const take = Number(query.limit || 10);
    const where: Prisma.PrescriptionWhereInput = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.status && query.status !== 'all') where.status = query.status;
    const scoped = doctorScopeId(user);
    if (scoped) where.doctorId = scoped;

    const { data, total } = await this.repo.findAll(where, {
      skip: pageNum * take,
      take,
      ...orderByOption<Prisma.PrescriptionOrderByWithRelationInput[]>(
        query,
        'createdAt',
      ),
    });
    return { data: data.map((r) => this.toResponse(r)), total };
  }

  async findOne(id: string, user: AuthUserView) {
    return this.toResponse(await this.getAccessible(id, user));
  }

  async cancel(id: string, user: AuthUserView) {
    await this.getAccessible(id, user);
    const n = await this.repo.transition(id, 'issued', { status: 'cancelled' });
    if (!n) throw new ConflictException(PRESCRIPTION_NOT_ACTIVE);
    return this.toResponse(await this.getAccessible(id, user));
  }

  /** Pharmacy: active (issued, not expired) prescriptions by code or phone. */
  async pharmacySearch(q: string) {
    const term = q.trim();
    const digits = term.replace(/\D/g, '');
    const today = parseDateOnlyToUTC(todayInTashkent());
    const byCode =
      /^[A-Za-z0-9-]{6,12}$/.test(term) && !/^\+?\d{9,}$/.test(term);

    const where: Prisma.PrescriptionWhereInput = {
      status: 'issued',
      validUntil: { gte: today },
      patient: { deletedAt: null },
      ...(byCode
        ? { code: term.replace(/-/g, '').toUpperCase() }
        : digits.length >= 9
          ? {
              patient: {
                deletedAt: null,
                phone: { in: [term, digits, `+${digits}`] },
              },
            }
          : { id: '' }),
    };
    const { data } = await this.repo.findAll(where, { take: 20 });
    return data.map((r) => this.toResponse(r));
  }

  async dispense(id: string, user: AuthUserView) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException(PRESCRIPTION_NOT_FOUND);
    if (row.validUntil < parseDateOnlyToUTC(todayInTashkent())) {
      throw new ConflictException(PRESCRIPTION_EXPIRED);
    }
    const n = await this.repo.transition(
      id,
      'issued',
      { status: 'dispensed', dispensedAt: new Date(), dispensedBy: user.id },
      parseDateOnlyToUTC(todayInTashkent()),
    );
    if (!n) throw new ConflictException(PRESCRIPTION_NOT_ACTIVE);
    return this.toResponse((await this.repo.findById(id)) as PrescriptionRow);
  }

  private async getAccessible(id: string, user: AuthUserView) {
    const scoped = doctorScopeId(user);
    const row = await this.repo.findById(id);
    if (!row || (scoped && row.doctorId !== scoped)) {
      throw new NotFoundException(PRESCRIPTION_NOT_FOUND);
    }
    return row;
  }

  private toResponse(r: PrescriptionRow) {
    return {
      id: r.id,
      code: r.code,
      patientId: r.patientId,
      doctorId: r.doctorId,
      visitId: r.visitId ?? undefined,
      status: r.status,
      notes: r.notes,
      validUntil: toDateOnlyString(r.validUntil),
      createdAt: r.createdAt.toISOString(),
      dispensedAt: r.dispensedAt ? r.dispensedAt.toISOString() : null,
      patient: r.patient
        ? {
            firstName: r.patient.firstName,
            lastName: r.patient.lastName,
            age: r.patient.age,
          }
        : undefined,
      doctor: r.doctor
        ? {
            firstName: r.doctor.firstName,
            lastName: r.doctor.lastName,
            specialty: r.doctor.specialty,
          }
        : undefined,
      items: r.items.map((i) => ({
        id: i.id,
        name: i.name,
        dosage: i.dosage,
        frequency: i.frequency,
        duration: i.duration,
        quantity: i.quantity,
        instructions: i.instructions,
      })),
    };
  }
}
