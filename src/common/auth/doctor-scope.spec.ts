import { ForbiddenException } from '@nestjs/common';
import {
  DOCTOR_PROFILE_MISSING_MESSAGE,
  doctorPatientsWhere,
  doctorScopeId,
} from './doctor-scope';
import type { AuthUserView } from '../../auth/auth.service';

describe('doctorScopeId', () => {
  const base: AuthUserView = { id: 'u1', name: 'N', phone: 'p', role: 'admin' };

  it.each(['admin', 'receptionist'] as const)(
    '%s — cheklov yo‘q (null)',
    (role) => {
      expect(doctorScopeId({ ...base, role })).toBeNull();
    },
  );

  it('doctor — o‘z Doctor id si', () => {
    expect(doctorScopeId({ ...base, role: 'doctor', doctorId: 'd1' })).toBe(
      'd1',
    );
  });

  it('doctor, Doctor yozuvi yo‘q — 403 (hech qachon hamma ma’lumot emas)', () => {
    expect(() => doctorScopeId({ ...base, role: 'doctor' })).toThrow(
      new ForbiddenException(DOCTOR_PROFILE_MISSING_MESSAGE),
    );
    expect(() =>
      doctorScopeId({ ...base, role: 'doctor', doctorId: '' }),
    ).toThrow(ForbiddenException);
  });
});

describe('doctorPatientsWhere', () => {
  it('biriktirilgan, qabul yoki tashrif orqali', () => {
    expect(doctorPatientsWhere('d1')).toEqual({
      OR: [
        { assignedDoctorId: 'd1' },
        { bookings: { some: { doctorId: 'd1' } } },
        { visits: { some: { doctorId: 'd1' } } },
      ],
    });
  });
});
