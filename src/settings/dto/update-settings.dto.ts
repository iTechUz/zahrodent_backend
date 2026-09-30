import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TEMPLATE_HINT =
  'Placeholderlar: {name} (bemor), {date} (DD.MM.YYYY), {time} (HH:mm), {doctor} (shifokor), {clinic} (klinika nomi). Maks. 500 belgi.';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Zahro Dental', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  clinicName?: string;

  @ApiPropertyOptional({
    example: 'Toshkent, Chilonzor 1-kvartal',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: '+998901234567', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Du–Sha 09:00–18:00', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workingHours?: string;

  @ApiPropertyOptional({ description: TEMPLATE_HINT, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  smsReminderTemplate?: string;

  @ApiPropertyOptional({ description: TEMPLATE_HINT, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  telegramReminderTemplate?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 7,
    example: 1,
    description:
      'Eslatma oynasi: bugundan bugun+N gacha (Asia/Tashkent). 0 — faqat bugun.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  reminderDaysAhead?: number;
}
