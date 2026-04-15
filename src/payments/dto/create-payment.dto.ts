import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const METHODS = ['cash', 'card', 'transfer', 'insurance'] as const;
const STATUSES = ['paid', 'partial', 'unpaid'] as const;

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
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  visitId?: string;
}
