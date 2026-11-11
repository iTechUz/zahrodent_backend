import { BadRequestException } from '@nestjs/common';
import {
  assertServiceForCompletion,
  assertStatusTransition,
} from './booking-transitions';

const run = (
  from: string,
  to: string,
  role = 'receptionist',
  date = '2026-06-10',
) =>
  assertStatusTransition({
    from,
    to,
    role,
    bookingDate: date,
    today: '2026-06-10',
  });

describe('assertStatusTransition', () => {
  it('active statuses move freely', () => {
    for (const [f, t] of [
      ['pending', 'confirmed'],
      ['confirmed', 'arrived'],
      ['arrived', 'completed'],
      ['pending', 'cancelled'],
      ['confirmed', 'no-show'],
    ]) {
      expect(() => run(f, t)).not.toThrow();
    }
  });

  it('same status is a no-op', () => {
    expect(() => run('completed', 'completed')).not.toThrow();
  });

  it('terminal states: only admin reopens to pending/confirmed', () => {
    for (const from of ['completed', 'cancelled', 'no-show']) {
      expect(() => run(from, 'pending', 'admin')).not.toThrow();
      expect(() => run(from, 'confirmed', 'admin')).not.toThrow();
      expect(() => run(from, 'pending', 'receptionist')).toThrow(
        BadRequestException,
      );
    }
    expect(() => run('cancelled', 'completed', 'admin')).toThrow(
      BadRequestException,
    );
    expect(() => run('no-show', 'arrived', 'admin')).toThrow(
      BadRequestException,
    );
  });

  it('completed → cancelled is forbidden even for admin', () => {
    expect(() => run('completed', 'cancelled', 'admin')).toThrow(
      "Yakunlangan qabulni bekor qilib bo'lmaydi",
    );
  });

  it('completed not before the booking date', () => {
    expect(() => run('confirmed', 'completed', 'admin', '2026-06-11')).toThrow(
      'Kelajakdagi',
    );
    expect(() =>
      run('confirmed', 'completed', 'admin', '2026-06-09'),
    ).not.toThrow();
  });
});
