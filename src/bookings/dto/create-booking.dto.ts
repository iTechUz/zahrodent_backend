import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { TIME_HH_MM_REGEX } from '../../common/utils/date.util';
import { IsRealDateOnly } from '../../common/validators/is-real-date-only';

export const BOOKING_SOURCES = [
  'walk-in',
  'telegram',
  'website',
  'phone',
] as const;
const SOURCES = BOOKING_SOURCES;
export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'arrived',
  'no-show',
  'completed',
  'cancelled',
] as const;
const STATUSES = BOOKING_STATUSES;

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  patientId: string;

  @IsString()
  @MinLength(1)
  doctorId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsRealDateOnly()
  date: string;

  @IsString()
  @Matches(TIME_HH_MM_REGEX, {
    message: 'time HH:mm formatida bo‘lishi kerak (00:00–23:59)',
  })
  time: string;

  @IsIn(SOURCES)
  source: (typeof SOURCES)[number];

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}
