import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/** class-validator default (English) texts → Uzbek. Custom Uzbek messages pass through. */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/should not be empty/i, () => "bo'sh bo'lmasligi kerak"],
  [/must be a string/i, () => "matn bo'lishi kerak"],
  [/must be an integer number/i, () => "butun son bo'lishi kerak"],
  [/must be a number/i, () => "son bo'lishi kerak"],
  [/must be a boolean/i, () => "ha/yo'q qiymati bo'lishi kerak"],
  [/must be an array/i, () => "ro'yxat bo'lishi kerak"],
  [/must be an email/i, () => "email noto'g'ri formatda"],
  [/must be a valid ISO 8601 date string/i, () => "sana noto'g'ri formatda"],
  [/must be a Date instance/i, () => "sana noto'g'ri formatda"],
  [
    /must be longer than or equal to (\d+) characters/i,
    (m) => `kamida ${m[1]} ta belgi bo'lishi kerak`,
  ],
  [
    /must be shorter than or equal to (\d+) characters/i,
    (m) => `ko'pi bilan ${m[1]} ta belgi bo'lishi kerak`,
  ],
  [
    /must not be less than (\S+)/i,
    (m) => `${m[1]} dan kichik bo'lmasligi kerak`,
  ],
  [
    /must not be greater than (\S+)/i,
    (m) => `${m[1]} dan katta bo'lmasligi kerak`,
  ],
  [/must be one of the following values/i, () => 'ruxsat etilmagan qiymat'],
  [/must be a valid phone number/i, () => "telefon raqami noto'g'ri"],
  [/must be a URL address/i, () => "havola noto'g'ri formatda"],
  [/must be a UUID/i, () => "identifikator noto'g'ri formatda"],
  [/should not exist/i, () => 'bunday maydon qabul qilinmaydi'],
  [/must match .* regular expression/i, () => "noto'g'ri formatda"],
];

/** One constraint text → Uzbek (unknown texts are returned as they are). */
export function translateConstraint(text: string): string {
  // "property x should not exist" has the property inside the text.
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

/** ValidationPipe `exceptionFactory`: 400 with Uzbek "field: message" lines. */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const messages = errors.map((err) => {
    const list = Object.values(err.constraints || {}).map(translateConstraint);
    return `${err.property}: ${list.join(', ')}`;
  });
  return new BadRequestException(messages);
}
