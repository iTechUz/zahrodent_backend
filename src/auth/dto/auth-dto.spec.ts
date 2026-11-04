import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { ChangePasswordDto } from './change-password.dto';

/** Returns { property: [messages] } for failed validations. */
function errorsOf(cls: new () => object, plain: Record<string, unknown>) {
  const out: Record<string, string[]> = {};
  for (const e of validateSync(plainToInstance(cls, plain))) {
    if (e.constraints) out[e.property] = Object.values(e.constraints);
  }
  return out;
}

describe('LoginDto', () => {
  it('to‘g‘ri', () => {
    expect(
      errorsOf(LoginDto, { phone: '+998901234567', password: 'x' }),
    ).toEqual({});
  });

  it('maydonlar yo‘q — ikkalasi ham xato', () => {
    expect(Object.keys(errorsOf(LoginDto, {})).sort()).toEqual([
      'password',
      'phone',
    ]);
  });

  it('parol string bo‘lishi kerak', () => {
    expect(
      errorsOf(LoginDto, { phone: '+998901234567', password: 123456 }),
    ).toHaveProperty('password');
  });

  it('telefon string bo‘lmasa rad etiladi', () => {
    expect(
      errorsOf(LoginDto, { phone: 998901234567, password: 'x' }),
    ).toHaveProperty('phone');
  });
});

describe('RefreshTokenDto', () => {
  it('to‘g‘ri', () => {
    expect(errorsOf(RefreshTokenDto, { refresh_token: 'abc123' })).toEqual({});
  });

  it('majburiy', () => {
    expect(errorsOf(RefreshTokenDto, {})).toHaveProperty('refresh_token');
  });

  it('bo‘sh — Uzbek xabar', () => {
    expect(
      errorsOf(RefreshTokenDto, { refresh_token: '' }).refresh_token,
    ).toEqual(['refresh_token majburiy']);
  });

  it('512 belgi — o‘tadi, 513 — yiqiladi', () => {
    expect(
      errorsOf(RefreshTokenDto, { refresh_token: 'a'.repeat(512) }),
    ).toEqual({});
    expect(
      errorsOf(RefreshTokenDto, { refresh_token: 'a'.repeat(513) }),
    ).toHaveProperty('refresh_token');
  });

  it('string bo‘lmasa rad etiladi', () => {
    expect(errorsOf(RefreshTokenDto, { refresh_token: 42 })).toHaveProperty(
      'refresh_token',
    );
  });
});

describe('ChangePasswordDto', () => {
  const valid = { currentPassword: 'old', newPassword: 'new-strong-pass' };

  it('to‘g‘ri', () => {
    expect(errorsOf(ChangePasswordDto, valid)).toEqual({});
  });

  it('ikkala maydon majburiy', () => {
    expect(Object.keys(errorsOf(ChangePasswordDto, {})).sort()).toEqual([
      'currentPassword',
      'newPassword',
    ]);
  });

  it('joriy parol bo‘sh — Uzbek xabar', () => {
    expect(
      errorsOf(ChangePasswordDto, { ...valid, currentPassword: '' })
        .currentPassword,
    ).toEqual(['Joriy parol majburiy']);
  });

  it('joriy parol 72 belgigacha', () => {
    expect(
      errorsOf(ChangePasswordDto, {
        ...valid,
        currentPassword: 'a'.repeat(72),
      }),
    ).toEqual({});
    expect(
      errorsOf(ChangePasswordDto, {
        ...valid,
        currentPassword: 'a'.repeat(73),
      }),
    ).toHaveProperty('currentPassword');
  });

  it('yangi parol 8 dan qisqa — Uzbek xabar', () => {
    expect(
      errorsOf(ChangePasswordDto, { ...valid, newPassword: 'a'.repeat(7) })
        .newPassword,
    ).toEqual(["Yangi parol kamida 8 belgidan iborat bo'lishi kerak"]);
  });

  it('yangi parol chegaralari 8 va 72', () => {
    expect(
      errorsOf(ChangePasswordDto, { ...valid, newPassword: 'a'.repeat(8) }),
    ).toEqual({});
    expect(
      errorsOf(ChangePasswordDto, { ...valid, newPassword: 'a'.repeat(72) }),
    ).toEqual({});
    expect(
      errorsOf(ChangePasswordDto, { ...valid, newPassword: 'a'.repeat(73) })
        .newPassword,
    ).toEqual(['Yangi parol 72 belgidan oshmasligi kerak']);
  });

  it('string bo‘lmagan qiymatlar rad etiladi', () => {
    const errs = errorsOf(ChangePasswordDto, {
      currentPassword: 1,
      newPassword: 12345678,
    });
    expect(errs).toHaveProperty('currentPassword');
    expect(errs).toHaveProperty('newPassword');
  });
});
