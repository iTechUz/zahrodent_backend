import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateDoctorDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  specialty: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)",
  })
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
