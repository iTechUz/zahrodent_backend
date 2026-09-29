import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const strategy = new JwtStrategy();
  const valid = {
    sub: 'u1',
    role: 'doctor',
    phone: '+998901234567',
    name: 'Dr',
    specialty: 'Terapevt',
    avatar: 'a.png',
    doctorId: 'd1',
  };

  it('to‘g‘ri payload — AuthUserView', () => {
    expect(strategy.validate(valid)).toEqual({
      id: 'u1',
      name: 'Dr',
      phone: '+998901234567',
      role: 'doctor',
      specialty: 'Terapevt',
      avatar: 'a.png',
      doctorId: 'd1',
    });
  });

  it('ixtiyoriy maydonlarsiz ham qabul qilinadi', () => {
    const out = strategy.validate({
      sub: 'u2',
      role: 'admin',
      phone: '+998',
      name: 'A',
    });
    expect(out).toMatchObject({ id: 'u2', role: 'admin' });
    expect(out.doctorId).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['string', 'token'],
    ['sub yo‘q', { ...valid, sub: undefined }],
    ['phone yo‘q', { ...valid, phone: undefined }],
    ['name raqam', { ...valid, name: 1 }],
    ['noma’lum rol', { ...valid, role: 'superadmin' }],
    ['role yo‘q', { ...valid, role: undefined }],
  ])('eski/noto‘g‘ri payload (%s) — 401', (_label, payload) => {
    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    expect(() => strategy.validate(payload)).toThrow(
      'Token yangilanishi kerak — qayta kiring',
    );
  });
});
