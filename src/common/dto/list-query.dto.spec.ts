import 'reflect-metadata';
import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { buildOrderBy } from './pagination.dto';
import { PatientsQueryDto } from '../../patients/dto/patients-query.dto';
import { BookingsQueryDto } from '../../bookings/dto/bookings-query.dto';
import { VisitsQueryDto } from '../../visits/dto/visits-query.dto';
import { PaymentsQueryDto } from '../../payments/dto/payments-query.dto';
import { ServicesQueryDto } from '../../services/dto/services-query.dto';
import { DoctorsQueryDto } from '../../doctors/dto/doctors-query.dto';
import { LeadsQueryDto } from '../../leads/dto/leads-query.dto';
import { UsersQueryDto } from '../../users/dto/users-query.dto';
import {
  DashboardQueryDto,
  MonthlyQueryDto,
  SourcesQueryDto,
} from '../../analytics/dto/analytics-query.dto';

/** Same options as the global pipe in main.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const run = (metatype: new () => object, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'query', metatype } as ArgumentMetadata);

const rejects = async (
  metatype: new () => object,
  value: Record<string, unknown>,
) => {
  await expect(run(metatype, value)).rejects.toBeInstanceOf(
    BadRequestException,
  );
};

describe('List query DTOs (ValidationPipe, forbidNonWhitelisted)', () => {
  // Query strings arrive as strings — exactly what the admin panel sends.
  it.each<[string, new () => object, Record<string, string>]>([
    [
      'patients',
      PatientsQueryDto,
      {
        page: '0',
        limit: '10',
        search: 'Ali',
        source: 'all',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        debtOnly: 'true',
        sortBy: 'lastName',
        order: 'desc',
      },
    ],
    [
      'bookings',
      BookingsQueryDto,
      {
        page: '1',
        limit: '10',
        search: '',
        status: 'all',
        source: 'phone',
        patientId: 'p1',
        doctorId: 'd1',
        dateRange: 'month',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        sortBy: 'time',
        order: 'asc',
      },
    ],
    [
      'visits',
      VisitsQueryDto,
      { patientId: 'p1', doctorId: 'd1', limit: '100', sortBy: 'price' },
    ],
    [
      'payments',
      PaymentsQueryDto,
      {
        status: 'paid',
        method: 'all',
        type: 'EXPENSE',
        dateRange: 'today',
        patientId: 'p1',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        page: '0',
        limit: '10',
        search: 'x',
        sortBy: 'amount',
        order: 'desc',
      },
    ],
    [
      'services',
      ServicesQueryDto,
      { page: '0', limit: '20', category: 'all', sortBy: 'price' },
    ],
    [
      'doctors',
      DoctorsQueryDto,
      { page: '0', limit: '100', specialty: 'Terapevt', sortBy: 'lastName' },
    ],
    [
      'leads',
      LeadsQueryDto,
      {
        page: '0',
        limit: '20',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        status: 'new',
        source: 'telegram_bot',
        sortBy: 'updatedAt',
        order: 'asc',
      },
    ],
    ['users', UsersQueryDto, { sortBy: 'name', order: 'asc' }],
  ])(
    '%s — admin yuboradigan parametrlar qabul qilinadi',
    async (_n, dto, q) => {
      const out = (await run(dto, q)) as Record<string, unknown>;
      if ('limit' in q) expect(typeof out.limit).toBe('number');
    },
  );

  it('page/limit raqamga aylanadi, defaultlar qo‘yiladi', async () => {
    await expect(run(PatientsQueryDto, {})).resolves.toMatchObject({
      page: 0,
      limit: 10,
    });
    await expect(
      run(BookingsQueryDto, { page: '2', limit: '5' }),
    ).resolves.toMatchObject({ page: 2, limit: 5 });
  });

  it.each<[string, new () => object, Record<string, unknown>]>([
    ['limit > 100', PatientsQueryDto, { limit: '1000' }],
    ['limit 0', BookingsQueryDto, { limit: '0' }],
    ['page NaN', VisitsQueryDto, { page: 'abc' }],
    [
      'search massiv (?search=a&search=b)',
      PaymentsQueryDto,
      { search: ['a', 'b'] },
    ],
    ['noma’lum parametr', ServicesQueryDto, { foo: 'bar' }],
    [
      'sortBy whitelist dan tashqari',
      DoctorsQueryDto,
      { sortBy: 'passwordHash' },
    ],
    ['order noto‘g‘ri', LeadsQueryDto, { order: 'up' }],
    [
      'operator injection (status[not]=)',
      LeadsQueryDto,
      { status: { not: 'x' } },
    ],
    ['status enum dan tashqari', BookingsQueryDto, { status: 'done' }],
    ['dateRange noto‘g‘ri', PaymentsQueryDto, { dateRange: 'year' }],
    ['startDate formati', PatientsQueryDto, { startDate: '01.09.2026' }],
    ['debtOnly noto‘g‘ri', PatientsQueryDto, { debtOnly: 'yes' }],
    ['users — pagination yo‘q', UsersQueryDto, { page: '0' }],
    ['monthly > 24', MonthlyQueryDto, { months: '25' }],
    ['monthly < 1', MonthlyQueryDto, { months: '0' }],
    ['dashboard date formati', DashboardQueryDto, { date: '2026-9-1' }],
  ])('%s — 400', async (_n, dto, q) => {
    await rejects(dto, q);
  });

  it('analytics sources — type default bookings, patients qabul, boshqasi 400', async () => {
    await expect(run(SourcesQueryDto, {})).resolves.toMatchObject({
      type: 'bookings',
    });
    await expect(
      run(SourcesQueryDto, { type: 'patients' }),
    ).resolves.toMatchObject({ type: 'patients' });
    await rejects(SourcesQueryDto, { type: 'leads' });
  });

  it('analytics — months default 6, date ixtiyoriy', async () => {
    await expect(run(MonthlyQueryDto, {})).resolves.toMatchObject({
      months: 6,
    });
    await expect(run(MonthlyQueryDto, { months: '12' })).resolves.toMatchObject(
      { months: 12 },
    );
    await expect(
      run(DashboardQueryDto, { date: '2026-09-30' }),
    ).resolves.toMatchObject({ date: '2026-09-30' });
  });
});

describe('buildOrderBy', () => {
  it('hech narsa berilmasa undefined (standart tartib saqlanadi)', () => {
    expect(buildOrderBy({}, 'createdAt')).toBeUndefined();
  });

  it('sortBy + order, id tie-breaker bilan', () => {
    expect(
      buildOrderBy({ sortBy: 'name', order: 'desc' }, 'createdAt'),
    ).toEqual([{ name: 'desc' }, { id: 'desc' }]);
  });

  it('faqat sortBy — asc; faqat order — standart maydon', () => {
    expect(buildOrderBy({ sortBy: 'name' }, 'createdAt')).toEqual([
      { name: 'asc' },
      { id: 'asc' },
    ]);
    expect(buildOrderBy({ order: 'desc' }, 'createdAt')).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});
