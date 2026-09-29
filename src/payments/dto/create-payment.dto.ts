import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'transfer',
  'insurance',
] as const;
export const PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'] as const;
export const PAYMENT_TYPES = ['INCOME', 'EXPENSE'] as const;
const METHODS = PAYMENT_METHODS;
const STATUSES = PAYMENT_STATUSES;
const TYPES = PAYMENT_TYPES;

export class CreatePaymentDto {
  @IsString()
  @MinLength(1)
  patientId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsIn(METHODS)
  method: (typeof METHODS)[number];

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @IsString()
  @MinLength(3)
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date YYYY-MM-DD formatida bo‘lishi kerak',
  })
  date?: string;

  @IsOptional()
  @IsString()
  visitId?: string;
}
