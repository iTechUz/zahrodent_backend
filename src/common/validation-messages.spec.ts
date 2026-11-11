import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import {
  translateConstraint,
  validationExceptionFactory,
} from './validation-messages';
import { LoginDto } from '../auth/dto/login.dto';
import { CreateLeadDto } from '../leads/dto/create-lead.dto';

describe('validation messages (Uzbek)', () => {
  it.each([
    ['name should not be empty', "bo'sh bo'lmasligi kerak"],
    ['name must be a string', "matn bo'lishi kerak"],
    ['age must be an integer number', "butun son bo'lishi kerak"],
    ['x must be an email', "email noto'g'ri formatda"],
    [
      'password must be longer than or equal to 6 characters',
      "kamida 6 ta belgi bo'lishi kerak",
    ],
    [
      'name must be shorter than or equal to 100 characters',
      "ko'pi bilan 100 ta belgi bo'lishi kerak",
    ],
    ['property foo should not exist', 'bunday maydon qabul qilinmaydi'],
    [
      'status must be one of the following values: a, b',
      'ruxsat etilmagan qiymat',
    ],
  ])('%s', (src, expected) => {
    expect(translateConstraint(src)).toBe(expected);
  });

  it('o‘zbekcha / noma’lum matn o‘zgarmaydi', () => {
    expect(translateConstraint("Telefon raqami noto'g'ri")).toBe(
      "Telefon raqami noto'g'ri",
    );
  });

  it('factory — 400 va "maydon: xabar" qatorlari o‘zbekcha', async () => {
    const errors = await validate(
      plainToInstance(CreateLeadDto, { name: '', phone: 'abc', lang: 'de' }),
    );
    const ex = validationExceptionFactory(errors);
    expect(ex).toBeInstanceOf(BadRequestException);
    expect(ex.getStatus()).toBe(400);
    const msgs = (ex.getResponse() as { message: string[] }).message;
    expect(msgs.join('|')).not.toMatch(/should not|must be|Invalid/);
    expect(msgs).toContain("name: bo'sh bo'lmasligi kerak");
    expect(msgs).toContain("phone: Telefon raqami noto'g'ri formatda");
  });

  it('LoginDto — bo‘sh parol o‘zbekcha', async () => {
    const errors = await validate(
      plainToInstance(LoginDto, { phone: '+998901234567', password: '' }),
    );
    const msgs = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(msgs).toEqual(['Parolni kiriting']);
  });
});
