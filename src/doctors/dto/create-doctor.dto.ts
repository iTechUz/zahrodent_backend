import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** HH:mm (optional :ss accepted for schedules saved by older clients). */
const SCHEDULE_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class ScheduleSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @IsString()
  @Matches(SCHEDULE_TIME_REGEX, {
    message: 'startTime HH:mm formatida bo‘lishi kerak',
  })
  startTime: string;

  @IsString()
  @Matches(SCHEDULE_TIME_REGEX, {
    message: 'endTime HH:mm formatida bo‘lishi kerak',
  })
  endTime: string;

  @IsBoolean()
  isWorking: boolean;
}

export class CreateDoctorDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsString()
  @MinLength(1)
  specialty: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)",
  })
  phone: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  schedule?: ScheduleSlotDto[];

  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'daysOff sanalari YYYY-MM-DD formatida bo‘lishi kerak',
  })
  daysOff?: string[];
}
