import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  specialty: string;

  @IsString()
  @Matches(/^\+?[\d\s-]{10,20}$/, { message: 'Invalid phone' })
  phone: string;

  @IsString()
  @MinLength(1)
  workingHours: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  schedule?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  daysOff?: string[];
}
