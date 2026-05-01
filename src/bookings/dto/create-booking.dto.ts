import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsDateString,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  branchId: string;

  @IsString()
  @MinLength(1)
  patientId: string;

  @IsString()
  @MinLength(1)
  doctorId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsString()
  @MinLength(1)
  source: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}
