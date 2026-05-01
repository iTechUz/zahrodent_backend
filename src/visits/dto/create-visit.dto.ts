import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVisitDto {
  @IsString()
  @MinLength(1)
  patientId: string;

  @IsString()
  @MinLength(1)
  doctorId: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsString()
  @MinLength(1)
  status: string; // e.g. "completed"

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;
}
