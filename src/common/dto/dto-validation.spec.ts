import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreateBookingDto } from '../../bookings/dto/create-booking.dto';
import { UpdateBookingDto } from '../../bookings/dto/update-booking.dto';
import { CreateDoctorDto } from '../../doctors/dto/create-doctor.dto';
import { UpdateDoctorDto } from '../../doctors/dto/update-doctor.dto';
import { CreateLeadDto } from '../../leads/dto/create-lead.dto';
import { UpdateLeadDto } from '../../leads/dto/update-lead.dto';
import {
  BulkSendDto,
  RecipientQueryDto,
} from '../../notifications/dto/bulk-sms.dto';
import { CreateNotificationDto } from '../../notifications/dto/create-notification.dto';
import { CreatePatientDto } from '../../patients/dto/create-patient.dto';
import { UpdatePatientDto } from '../../patients/dto/update-patient.dto';
import { CreatePatientCommentDto } from '../../patients/dto/create-patient-comment.dto';
import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';
import { UpdatePaymentDto } from '../../payments/dto/update-payment.dto';
import { CreateServiceDto } from '../../services/dto/create-service.dto';
import { UpdateServiceDto } from '../../services/dto/update-service.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { CreateVisitDto } from '../../visits/dto/create-visit.dto';
import { UpdateVisitDto } from '../../visits/dto/update-visit.dto';

/** Returns { property: [messages] } for failed validations (nested flattened). */
function errorsOf(cls: new () => object, plain: Record<string, unknown>) {
  const inst = plainToInstance(cls, plain);
  const out: Record<string, string[]> = {};
  const walk = (errs: ReturnType<typeof validateSync>, prefix = '') => {
    for (const e of errs) {
      const key = prefix + e.property;
      if (e.constraints) out[key] = Object.values(e.constraints);
      if (e.children?.length) walk(e.children, `${key}.`);
    }
  };
  walk(validateSync(inst));
  return out;
}

const PHONE_MSG = "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)";
const DATE_MSG = 'date YYYY-MM-DD formatida bo‘lishi kerak';

describe('DTO validation', () => {
  describe('PaginationQueryDto', () => {
    it('defaultlar page=0, limit=10', () => {
      const q = plainToInstance(PaginationQueryDto, {});
      expect(q.page).toBe(0);
      expect(q.limit).toBe(10);
      expect(errorsOf(PaginationQueryDto, {})).toEqual({});
    });

    it('string raqamlar Number ga o‘giriladi', () => {
      const q = plainToInstance(PaginationQueryDto, { page: '2', limit: '50' });
      expect(q).toMatchObject({ page: 2, limit: 50 });
    });

    it('chegaralar: page<0, limit<1, limit>100000, kasr', () => {
      expect(Object.keys(errorsOf(PaginationQueryDto, { page: -1 }))).toEqual([
        'page',
      ]);
      expect(errorsOf(PaginationQueryDto, { limit: 0 })).toHaveProperty(
        'limit',
      );
      expect(errorsOf(PaginationQueryDto, { limit: 100001 })).toHaveProperty(
        'limit',
      );
      expect(errorsOf(PaginationQueryDto, { limit: 100000 })).toEqual({});
      expect(errorsOf(PaginationQueryDto, { page: 1.5 })).toHaveProperty(
        'page',
      );
    });
  });

  describe('LoginDto', () => {
    it('to‘g‘ri', () => {
      expect(
        errorsOf(LoginDto, { phone: '+998901234567', password: 'x' }),
      ).toEqual({});
    });

    it.each([
      '998901234567',
      '+99890123456',
      '+9989012345678',
      '+998 90 123 45 67',
    ])('noto‘g‘ri telefon %s — Uzbek xabar', (phone) => {
      expect(errorsOf(LoginDto, { phone, password: 'x' }).phone).toEqual([
        PHONE_MSG,
      ]);
    });

    it('bo‘sh parol', () => {
      expect(
        errorsOf(LoginDto, { phone: '+998901234567', password: '' }).password,
      ).toEqual(['password is required']);
    });
  });

  describe('CreateBookingDto / UpdateBookingDto', () => {
    const ok = {
      patientId: 'p1',
      doctorId: 'd1',
      date: '2026-06-10',
      time: '10:00',
      source: 'phone',
      status: 'pending',
    };

    it('to‘g‘ri', () => {
      expect(errorsOf(CreateBookingDto, ok)).toEqual({});
    });

    it('sana formati — Uzbek xabar', () => {
      expect(
        errorsOf(CreateBookingDto, { ...ok, date: '10.06.2026' }).date,
      ).toEqual([DATE_MSG]);
    });

    it('noma’lum source/status', () => {
      const e = errorsOf(CreateBookingDto, {
        ...ok,
        source: 'instagram',
        status: 'done',
      });
      expect(Object.keys(e).sort()).toEqual(['source', 'status']);
    });

    it('majburiy maydonlar', () => {
      expect(Object.keys(errorsOf(CreateBookingDto, {})).sort()).toEqual([
        'date',
        'doctorId',
        'patientId',
        'source',
        'status',
        'time',
      ]);
    });

    it('Update — hammasi ixtiyoriy, lekin qoidalar saqlanadi', () => {
      expect(errorsOf(UpdateBookingDto, {})).toEqual({});
      expect(errorsOf(UpdateBookingDto, { serviceId: '' })).toEqual({});
      expect(errorsOf(UpdateBookingDto, { date: '2026/06/10' })).toHaveProperty(
        'date',
      );
    });

    // `time` is only validated as non-empty string; "25:99" or "abc" pass and
    // BookingsService.timeToMinutes() then yields NaN, which silently disables
    // the overlap check (NaN comparisons are always false).
    it.todo(
      'time HH:MM formatida validatsiya qilinishi kerak (bookings create-booking.dto.ts:34-36)',
    );
  });

  describe('CreateDoctorDto / UpdateDoctorDto', () => {
    const ok = {
      firstName: 'Aziz',
      lastName: 'K',
      specialty: 'Terapevt',
      phone: '+998901112233',
    };

    it('to‘g‘ri (schedule bilan)', () => {
      expect(
        errorsOf(CreateDoctorDto, {
          ...ok,
          password: 'secret',
          schedule: [
            { day: 1, startTime: '09:00', endTime: '18:00', isWorking: true },
          ],
          daysOff: ['2026-06-01'],
        }),
      ).toEqual({});
    });

    it('telefon formati va qisqa parol', () => {
      const e = errorsOf(CreateDoctorDto, {
        ...ok,
        phone: '901112233',
        password: '123',
      });
      expect(e.phone).toEqual([PHONE_MSG]);
      expect(e).toHaveProperty('password');
    });

    it('schedule elementlari nested tekshiriladi', () => {
      const e = errorsOf(CreateDoctorDto, {
        ...ok,
        schedule: [{ day: 'mon', startTime: 9, isWorking: 'yes' }],
        daysOff: [1],
      });
      expect(Object.keys(e).sort()).toEqual([
        'daysOff',
        'schedule.0.day',
        'schedule.0.endTime',
        'schedule.0.isWorking',
        'schedule.0.startTime',
      ]);
    });

    it('Update — bo‘sh ok', () => {
      expect(errorsOf(UpdateDoctorDto, {})).toEqual({});
      expect(errorsOf(UpdateDoctorDto, { phone: 'x' }).phone).toEqual([
        PHONE_MSG,
      ]);
    });
  });

  describe('Leads', () => {
    it('Create — name/phone majburiy, status enum', () => {
      expect(errorsOf(CreateLeadDto, { name: 'A', phone: '1' })).toEqual({});
      expect(
        Object.keys(errorsOf(CreateLeadDto, { name: '', phone: '' })).sort(),
      ).toEqual(['name', 'phone']);
      expect(
        errorsOf(CreateLeadDto, { name: 'A', phone: '1', status: 'won' }),
      ).toHaveProperty('status');
    });

    it('Update — status enum', () => {
      expect(errorsOf(UpdateLeadDto, { status: 'converted' })).toEqual({});
      expect(errorsOf(UpdateLeadDto, { status: 'x' })).toHaveProperty('status');
    });
  });

  describe('Notifications', () => {
    it('BulkSendDto', () => {
      expect(
        errorsOf(BulkSendDto, {
          targetIds: ['a'],
          targetType: 'patient',
          message: 'Salom!',
        }),
      ).toEqual({});
      const e = errorsOf(BulkSendDto, {
        targetIds: 'a',
        targetType: 1,
        message: 'Hi',
      });
      expect(Object.keys(e).sort()).toEqual([
        'message',
        'targetIds',
        'targetType',
      ]);
    });

    it('RecipientQueryDto — ISO sana', () => {
      expect(errorsOf(RecipientQueryDto, {})).toEqual({});
      expect(
        errorsOf(RecipientQueryDto, { startDate: '2026-06-01T00:00:00Z' }),
      ).toEqual({});
      expect(
        errorsOf(RecipientQueryDto, { startDate: 'yesterday' }),
      ).toHaveProperty('startDate');
    });

    it('CreateNotificationDto', () => {
      expect(
        errorsOf(CreateNotificationDto, { type: 'sms', message: 'x' }),
      ).toEqual({});
      const e = errorsOf(CreateNotificationDto, {
        type: 'email',
        message: '',
        status: 'queued',
        sentAt: '01/06/2026',
      });
      expect(Object.keys(e).sort()).toEqual([
        'message',
        'sentAt',
        'status',
        'type',
      ]);
    });
  });

  describe('Patients', () => {
    const ok = {
      firstName: 'Ali',
      lastName: 'V',
      age: '30',
      phone: '+998 90 111-22-33',
      source: 'walk-in',
      address: 'Toshkent',
      workplace: 'IT',
    };

    it('Create — to‘g‘ri, age string → number', () => {
      expect(errorsOf(CreatePatientDto, ok)).toEqual({});
      expect(plainToInstance(CreatePatientDto, ok).age).toBe(30);
    });

    it('Create — xatolar', () => {
      const e = errorsOf(CreatePatientDto, {
        ...ok,
        age: 0,
        phone: 'abc',
        source: 'tiktok',
        address: 'ab',
        toothChart: 'x',
      });
      expect(e.phone).toEqual(['Invalid phone']);
      expect(Object.keys(e).sort()).toEqual([
        'address',
        'age',
        'phone',
        'source',
        'toothChart',
      ]);
    });

    it('Update — bo‘sh ok; comment content majburiy', () => {
      expect(errorsOf(UpdatePatientDto, {})).toEqual({});
      expect(errorsOf(CreatePatientCommentDto, { content: '' })).toHaveProperty(
        'content',
      );
      expect(errorsOf(CreatePatientCommentDto, { content: 'ok' })).toEqual({});
    });
  });

  describe('Payments', () => {
    const ok = {
      patientId: 'p1',
      amount: '100000',
      method: 'cash',
      status: 'paid',
      description: 'Plomba',
    };

    it('Create — to‘g‘ri', () => {
      expect(errorsOf(CreatePaymentDto, ok)).toEqual({});
      expect(
        errorsOf(CreatePaymentDto, { ...ok, type: 'EXPENSE', discount: 0 }),
      ).toEqual({});
    });

    it('Create — xatolar', () => {
      const e = errorsOf(CreatePaymentDto, {
        ...ok,
        amount: 0,
        method: 'crypto',
        status: 'refunded',
        type: 'income',
        description: 'ab',
        discount: -1,
        date: '2026-6-1',
      });
      expect(e.date).toEqual([DATE_MSG]);
      expect(Object.keys(e).sort()).toEqual([
        'amount',
        'date',
        'description',
        'discount',
        'method',
        'status',
        'type',
      ]);
    });

    it('Update — bo‘sh ok, visitId "" (disconnect) ruxsat', () => {
      expect(errorsOf(UpdatePaymentDto, {})).toEqual({});
      expect(errorsOf(UpdatePaymentDto, { visitId: '' })).toEqual({});
    });
  });

  describe('Services', () => {
    it('Create — narx va davomiylik >= 1', () => {
      expect(
        errorsOf(CreateServiceDto, {
          name: 'P',
          category: 'T',
          price: '1',
          duration: '30',
        }),
      ).toEqual({});
      expect(
        Object.keys(
          errorsOf(CreateServiceDto, {
            name: '',
            category: 'T',
            price: 0,
            duration: 0,
          }),
        ).sort(),
      ).toEqual(['duration', 'name', 'price']);
    });

    it('Update — bo‘sh ok', () => {
      expect(errorsOf(UpdateServiceDto, {})).toEqual({});
    });
  });

  describe('Users', () => {
    const ok = {
      name: 'Ali',
      phone: '+998901112233',
      password: 'secret1',
      role: 'receptionist',
    };

    it('Create — to‘g‘ri va xatolar', () => {
      expect(errorsOf(CreateUserDto, ok)).toEqual({});
      const e = errorsOf(CreateUserDto, {
        ...ok,
        phone: '+99890',
        password: '123',
      });
      expect(e.phone).toEqual([PHONE_MSG]);
      expect(e).toHaveProperty('password');
    });

    it('Update — bo‘sh ok', () => {
      expect(errorsOf(UpdateUserDto, {})).toEqual({});
    });

    // BUG (users/dto/create-user.dto.ts:25-26): `role` is only @IsString(),
    // not @IsIn(['admin','doctor','receptionist']). An admin can create a user
    // with role "superadmin"/"Admin"; such a user gets a JWT that JwtStrategy
    // then rejects on every request (jwt.strategy.ts:17), i.e. an unusable
    // account instead of a 400.
    it.todo(
      'CreateUserDto.role faqat admin/doctor/receptionist bo‘lishi kerak',
    );
  });

  describe('Visits', () => {
    it('Create — to‘g‘ri va xatolar', () => {
      expect(
        errorsOf(CreateVisitDto, {
          patientId: 'p1',
          doctorId: 'd1',
          status: 'completed',
        }),
      ).toEqual({});
      const e = errorsOf(CreateVisitDto, {
        patientId: '',
        doctorId: 'd1',
        status: 'done',
        date: 'today',
        price: -5,
      });
      expect(e.date).toEqual([DATE_MSG]);
      expect(Object.keys(e).sort()).toEqual([
        'date',
        'patientId',
        'price',
        'status',
      ]);
    });

    it('Update — bo‘sh ok, bookingId "" ruxsat', () => {
      expect(errorsOf(UpdateVisitDto, {})).toEqual({});
      expect(errorsOf(UpdateVisitDto, { bookingId: '' })).toEqual({});
    });
  });
});
