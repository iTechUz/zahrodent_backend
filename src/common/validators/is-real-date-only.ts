import { registerDecorator, ValidationOptions } from 'class-validator';
import { DATE_ONLY_REGEX, isRealDateOnly } from '../utils/date.util';

/** `YYYY-MM-DD` that is a real calendar day (2026-02-30 → validation error). */
export function IsRealDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isRealDateOnly',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: {
        message: `${String(propertyKey)} mavjud bo‘lmagan sana`,
        ...options,
      },
      validator: {
        // Wrong format is reported by the accompanying @Matches, not twice.
        validate: (v: unknown) =>
          typeof v !== 'string' ||
          !DATE_ONLY_REGEX.test(v) ||
          isRealDateOnly(v),
      },
    });
  };
}
