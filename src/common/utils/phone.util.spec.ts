import { normalizeUzPhone } from './phone.util';

describe('normalizeUzPhone', () => {
  it.each([
    ['+998901234567', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['+998 90 123-45-67', '+998901234567'],
    ['901234567', '+998901234567'],
    ['(90) 123 45 67', '+998901234567'],
  ])('%p → %p', (raw, out) => {
    expect(normalizeUzPhone(raw)).toBe(out);
  });

  it.each([null, undefined, '', '+79991234567', '12345', '9989012345678'])(
    '%p → null',
    (raw) => {
      expect(normalizeUzPhone(raw)).toBeNull();
    },
  );
});
