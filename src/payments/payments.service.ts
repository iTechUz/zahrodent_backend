import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PaymentActor,
  PaymentsRepository,
  PaymentWithPatient,
} from './payments.repository';
import { AuthUserView } from '../auth/auth.service';
import {
  connectActivePatient,
  toPatientSummary,
} from '../patients/patient-summary';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import {
  dateOnlyColumnRange,
  parseDateOnlyToUTC,
  relativeDateRange,
  toDateOnlyString,
  todayInTashkent,
} from '../common/utils/date.util';
import { orderByOption, PaginatedResponse } from '../common/dto/pagination.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { COLLECTED_PAYMENT_STATUSES } from '../patients/patient-balance';

export const PAYMENT_NOT_FOUND = "To'lov topilmadi";
export const PAYMENT_PATIENT_REQUIRED =
  "Kirim to'lovi uchun bemorni tanlang (bemorsiz faqat chiqim bo'lishi mumkin)";
export const PAYMENT_VISIT_NEEDS_PATIENT =
  "Tashrifga bog'langan to'lovda bemor ko'rsatilishi kerak";
export const PAYMENT_DATE_FUTURE =
  "Qabul qilingan to'lov sanasi kelajakda bo'lishi mumkin emas";
export const PAYMENT_DATE_TOO_OLD =
  "To'lov sanasi 2020-01-01 dan oldin bo'lmasligi kerak";
export const PAYMENT_DISCOUNT_TOO_BIG =
  'Chegirma tashrif narxidan oshmasligi kerak';

/** Earliest plausible payment date (the clinic's records start here). */
export const PAYMENT_MIN_DATE = '2020-01-01';

const actorOf = (user: AuthUserView): PaymentActor => ({
  id: user.id,
  name: user.name,
});

/** Identical payment re-submitted inside this window = accidental double click. */
export const PAYMENT_DUPLICATE_WINDOW_MS = 10_000;
export const PAYMENT_DUPLICATE_MESSAGE =
  "Xuddi shunday to'lov hozirgina kiritilgan (qayta yuborish ehtimoli) — 10 soniyadan keyin qayta urinib ko'ring";

@Injectable()
export class PaymentsService {
  /**
   * Double-submit guard: key (patient, visit, amount, type) → last accepted
   * time. In-memory (one API instance),
   * checked and claimed synchronously so concurrent requests can't both pass.
   */
  private readonly recentSubmissions = new Map<string, number>();

  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  private claimSubmission(dto: CreatePaymentDto): string {
    const now = Date.now();
    for (const [k, at] of this.recentSubmissions) {
      if (now - at >= PAYMENT_DUPLICATE_WINDOW_MS) {
        this.recentSubmissions.delete(k);
      }
    }
    const key = [
      dto.patientId ?? '',
      dto.visitId ?? '',
      dto.amount,
      dto.type || 'INCOME',
    ].join('|');
    if (this.recentSubmissions.has(key)) {
      throw new ConflictException(PAYMENT_DUPLICATE_MESSAGE);
    }
    this.recentSubmissions.set(key, now);
    return key;
  }

  async findAll(
    query: PaymentsQueryDto,
  ): Promise<PaginatedResponse<ReturnType<PaymentsService['toResponse']>>> {
    const {
      search,
      status,
      patientId,
      method,
      type,
      dateRange = 'all',
      startDate,
      endDate,
    } = query;
    const pageNum = Number(query.page || 0);
    const limitNum = Number(query.limit || 10);
    const skip = pageNum * limitNum;

    const where: Prisma.PaymentWhereInput = {};

    if (patientId) where.patientId = patientId;
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;
    if (type && type !== 'all') where.type = type;

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { firstName: { contains: s, mode: 'insensitive' } },
              { lastName: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.date = dateOnlyColumnRange(startDate, endDate);
    } else if (dateRange !== 'all') {
      const { start, end } = relativeDateRange(dateRange);
      where.date = dateOnlyColumnRange(start, end);
    }

    const { data, total } = await this.paymentsRepository.findAll(where, {
      skip,
      take: limitNum,
      ...orderByOption<Prisma.PaymentOrderByWithRelationInput[]>(query, 'date'),
    });
    return { data: data.map((p) => this.toResponse(p)), total };
  }

  async findOne(id: string) {
    const p = await this.getOrThrow(id);
    return this.toResponse(p);
  }

  async create(dto: CreatePaymentDto, user: AuthUserView) {
    const type = dto.type || 'INCOME';
    if (type === 'INCOME' && !dto.patientId) {
      throw new BadRequestException(PAYMENT_PATIENT_REQUIRED);
    }
    if (dto.visitId && !dto.patientId) {
      throw new BadRequestException(PAYMENT_VISIT_NEEDS_PATIENT);
    }
    const dateStr = dto.date ?? todayInTashkent();
    this.assertDate(dateStr, dto.status);
    if (dto.visitId && dto.patientId) {
      const visit = await this.assertVisitBelongs(dto.visitId, dto.patientId);
      this.assertDiscount(dto.discount, visit.price);
    }
    const claimed = this.claimSubmission(dto);
    let p: PaymentWithPatient;
    try {
      p = await this.insertPayment(dto, dateStr, actorOf(user));
    } catch (e) {
      // Nothing was saved → a retry is legitimate.
      this.recentSubmissions.delete(claimed);
      throw e;
    }
    return this.toResponse(p);
  }

  /** Money collected (paid|partial) can't be dated in the future; nothing before 2020. */
  private assertDate(dateStr: string, status: string) {
    if (dateStr < PAYMENT_MIN_DATE) {
      throw new BadRequestException(PAYMENT_DATE_TOO_OLD);
    }
    if (
      (COLLECTED_PAYMENT_STATUSES as readonly string[]).includes(status) &&
      dateStr > todayInTashkent()
    ) {
      throw new BadRequestException(PAYMENT_DATE_FUTURE);
    }
  }

  private assertDiscount(discount: number | null | undefined, price: number) {
    if (discount && discount > price) {
      throw new BadRequestException(PAYMENT_DISCOUNT_TOO_BIG);
    }
  }

  private insertPayment(
    dto: CreatePaymentDto,
    dateStr: string,
    actor: PaymentActor,
  ) {
    return this.paymentsRepository.createWithAudit(
      {
        patient: dto.patientId
          ? connectActivePatient(dto.patientId)
          : undefined,
        amount: dto.amount,
        method: dto.method,
        status: dto.status,
        date: parseDateOnlyToUTC(dateStr),
        description: dto.description,
        type: dto.type || 'INCOME',
        discount: dto.discount,
        service: dto.serviceId ? { connect: { id: dto.serviceId } } : undefined,
        visit: dto.visitId ? { connect: { id: dto.visitId } } : undefined,
      },
      actor,
    );
  }

  async update(id: string, dto: UpdatePaymentDto, user: AuthUserView) {
    const current = await this.getOrThrow(id);
    const nextVisitId =
      dto.visitId === undefined ? current.visitId : dto.visitId || null;
    const nextPatientId = dto.patientId ?? current.patientId;
    const nextType = dto.type ?? current.type;
    if (nextType === 'INCOME' && !nextPatientId) {
      throw new BadRequestException(PAYMENT_PATIENT_REQUIRED);
    }
    if (nextVisitId && !nextPatientId) {
      throw new BadRequestException(PAYMENT_VISIT_NEEDS_PATIENT);
    }
    if (dto.date !== undefined || dto.status !== undefined) {
      this.assertDate(
        dto.date ?? toDateOnlyString(current.date),
        dto.status ?? current.status,
      );
    }
    if (
      nextVisitId &&
      nextPatientId &&
      (dto.visitId !== undefined ||
        dto.patientId !== undefined ||
        dto.discount !== undefined)
    ) {
      const visit = await this.assertVisitBelongs(nextVisitId, nextPatientId);
      this.assertDiscount(dto.discount ?? current.discount, visit.price);
    }
    const p = await this.paymentsRepository.updateWithAudit(
      id,
      {
        amount: dto.amount,
        method: dto.method,
        status: dto.status,
        description: dto.description,
        type: dto.type,
        discount: dto.discount,
        date: dto.date === undefined ? undefined : parseDateOnlyToUTC(dto.date),
        patient:
          dto.patientId === undefined
            ? undefined
            : connectActivePatient(dto.patientId),
        service:
          dto.serviceId === undefined
            ? undefined
            : dto.serviceId
              ? { connect: { id: dto.serviceId } }
              : { disconnect: true },
        visit:
          dto.visitId === undefined
            ? undefined
            : dto.visitId
              ? { connect: { id: dto.visitId } }
              : { disconnect: true },
      },
      actorOf(user),
    );
    return this.toResponse(p);
  }

  /** Hard delete; the full row stays in the audit trail (payment_audits). */
  async remove(id: string, user: AuthUserView) {
    await this.getOrThrow(id);
    await this.paymentsRepository.deleteWithAudit(id, actorOf(user));
    return { id };
  }

  /** Change trail of a payment (also for already deleted ones). */
  async getAudit(id: string) {
    const rows = await this.paymentsRepository.listAudit(id);
    return rows.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      action: r.action,
      actorId: r.actorId,
      actorName: r.actorName,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Revenue = INCOME payments with status paid|partial (money received),
   * including payments of soft-deleted patients (money really came in).
   * Expenses (EXPENSE, "Chiqim") are reported separately, never mixed in.
   * pendingAmount = outstanding patient debt (see patient-balance.ts).
   */
  async getStats() {
    const today = parseDateOnlyToUTC(todayInTashkent());
    const collected = { in: [...COLLECTED_PAYMENT_STATUSES] };

    const [totalRevenue, todayRevenue, totalExpenses, todayExpenses, debt] =
      await Promise.all([
        this.paymentsRepository.sumAmount({
          type: 'INCOME',
          status: collected,
        }),
        this.paymentsRepository.sumAmount({
          type: 'INCOME',
          status: collected,
          date: today,
        }),
        this.paymentsRepository.sumAmount({
          type: 'EXPENSE',
          status: collected,
        }),
        this.paymentsRepository.sumAmount({
          type: 'EXPENSE',
          status: collected,
          date: today,
        }),
        this.paymentsRepository.getDebtSummary(),
      ]);

    return {
      totalRevenue: totalRevenue || 0,
      pendingAmount: debt.total || 0,
      todayRevenue: todayRevenue || 0,
      totalExpenses: totalExpenses || 0,
      todayExpenses: todayExpenses || 0,
    };
  }

  /**
   * Collected INCOME per doctor, attributed through the payment's visit.
   * `total` is kept for old clients; `revenue` is the same number under a
   * clearer name. `percent` is the doctor's share of `linkedTotal` — the sum
   * of payments linked to a visit — never of all clinic revenue (payments
   * without a visit belong to no doctor).
   */
  async getDoctorStats(period: { startDate?: string; endDate?: string } = {}) {
    const rows = await this.paymentsRepository.getDoctorStats(
      dateOnlyColumnRange(period.startDate, period.endDate),
    );
    const linkedTotal = rows.reduce((n, r) => n + r.total, 0);
    return rows.map((r) => ({
      doctorId: r.doctorId,
      total: r.total,
      revenue: r.total,
      linkedTotal,
      percent:
        linkedTotal > 0 ? Math.round((r.total / linkedTotal) * 1000) / 10 : 0,
    }));
  }

  private async getOrThrow(id: string) {
    const p = await this.paymentsRepository.findById(id);
    if (!p) throw new NotFoundException(PAYMENT_NOT_FOUND);
    return p;
  }

  private async assertVisitBelongs(
    visitId: string,
    patientId: string,
  ): Promise<{ price: number }> {
    const visit = await this.paymentsRepository.findVisitOwner(visitId);
    if (!visit) throw new NotFoundException('Tashrif topilmadi');
    if (visit.patientId !== patientId) {
      throw new BadRequestException(
        "Tashrif boshqa bemorga tegishli — to'lovni shu tashrifga bog'lab bo'lmaydi",
      );
    }
    return { price: visit.price ?? 0 };
  }

  private toResponse(p: PaymentWithPatient) {
    return {
      id: p.id,
      patientId: p.patientId,
      createdAt: p.createdAt ? p.createdAt.toISOString() : undefined,
      createdById: p.createdById ?? undefined,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: toDateOnlyString(p.date),
      description: p.description,
      type: p.type,
      discount: p.discount ?? undefined,
      serviceId: p.serviceId ?? undefined,
      visitId: p.visitId ?? undefined,
      patient: toPatientSummary(p.patient),
    };
  }
}
