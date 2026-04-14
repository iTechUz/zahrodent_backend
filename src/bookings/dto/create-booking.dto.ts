import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const SOURCES = ['walk-in', 'telegram', 'website', 'phone'] as const;
const STATUSES = [
  'pending',
  'confirmed',
  'arrived',
  'no-show',
  'completed',
  'cancelled',
] as const;

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  patientId: string;

  @IsString()
  @MinLength(1)
  doctorId: string;

  @IsString()
  @MinLength(10)
  date: string;

  @IsString()
  @MinLength(1)
  time: string;

  @IsIn(SOURCES)
  source: (typeof SOURCES)[number];

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}
