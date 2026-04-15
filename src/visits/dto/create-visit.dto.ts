import { IsInt, IsIn, IsOptional, IsString, Min, MinLength } from 'class-validator';

const STATUSES = ['not-started', 'in-progress', 'completed'] as const;

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
  date?: string;

  @IsIn(STATUSES)
  status: (typeof STATUSES)[number];

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
  @IsInt()
  @Min(0)
  price?: number;
}
