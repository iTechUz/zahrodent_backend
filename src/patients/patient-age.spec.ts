import { BadRequestException } from '@nestjs/common';
import { displayAge, resolveAgeFields } from './patient-age';

describe('resolveAgeFields', () => {
  it('birthYear ustun — yosh undan hisoblanadi', () => {
    expect(resolveAgeFields({ birthYear: 1990, age: 5 }, 2026)).toEqual({
      birthYear: 1990,
      age: 36,
    });
  });
  it('faqat age — birthYear undan chiqariladi', () => {
    expect(resolveAgeFields({ age: 30 }, 2026)).toEqual({
      age: 30,
      birthYear: 1996,
    });
  });
  it('age 0 ham to‘g‘ri qiymat', () => {
    expect(resolveAgeFields({ age: 0 }, 2026)).toEqual({
      age: 0,
      birthYear: 2026,
    });
  });
  it('hech biri yo‘q — null', () => {
    expect(resolveAgeFields({}, 2026)).toBeNull();
  });
  it('kelajakdagi tug‘ilgan yil — 400', () => {
    expect(() => resolveAgeFields({ birthYear: 2027 }, 2026)).toThrow(
      BadRequestException,
    );
  });
});

describe('displayAge', () => {
  it('birthYear bor — hisoblangan; yo‘q — age ustuni', () => {
    expect(displayAge({ age: 10, birthYear: 1990 }, 2026)).toBe(36);
    expect(displayAge({ age: 10, birthYear: null }, 2026)).toBe(10);
  });
});
