import {
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityDto } from './create-doctor.dto';

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
