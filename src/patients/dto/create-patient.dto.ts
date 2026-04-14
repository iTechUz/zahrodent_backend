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

const SOURCES = ['walk-in', 'telegram', 'website', 'phone'] as const;

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

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsObject()
  toothChart?: Record<string, unknown>;
}
