import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityDto {
  @IsNumber()
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsNumber()
  slotDuration?: number;
}

export class CreateDoctorDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsString()
  @MinLength(1)
  specialty: string;

  @IsNumber()
  experienceYears: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availabilities?: AvailabilityDto[];
}

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availabilities?: AvailabilityDto[];
}
