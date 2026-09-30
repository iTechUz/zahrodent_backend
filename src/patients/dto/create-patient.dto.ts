import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PATIENT_SOURCES = [
  'walk-in',
  'telegram',
  'website',
  'phone',
] as const;
const SOURCES = PATIENT_SOURCES;

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  age: number;

  @IsString()
  @Matches(/^\+?[\d\s-]{10,20}$/, { message: 'Invalid phone' })
  phone: string;

  @IsIn(SOURCES)
  source: (typeof SOURCES)[number];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @MinLength(3)
  address: string;

  @IsString()
  @MinLength(1)
  workplace: string;

  /** PATCH: `null` → shifokor biriktirilishini olib tashlash */
  @IsOptional()
  @IsString()
  assignedDoctorId?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsObject()
  toothChart?: Record<string, unknown>;
}
