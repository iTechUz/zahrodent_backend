import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentType, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MinLength(1)
  patientId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @MinLength(1)
  status: string; // e.g., "COMPLETED", "PENDING"

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
