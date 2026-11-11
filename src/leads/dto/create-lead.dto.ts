import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'consultation',
  'proposal',
  'converted',
  'cancelled',
] as const;

/** Languages of the public form (staff replies in the visitor's language). */
export const LEAD_LANGS = ['uz', 'ru', 'en'] as const;

export const LEAD_PHONE_REGEX = /^\+?[\d\s()-]{7,20}$/;

export class CreateLeadDto {
  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(LEAD_PHONE_REGEX, { message: "Telefon raqami noto'g'ri formatda" })
  phone: string;

  @ApiProperty({ example: 'Implantatsiya', required: false })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({ example: 'Dr. Karimov', required: false })
  @IsOptional()
  @IsString()
  doctor?: string;

  @ApiProperty({ example: '2026-11-02 10:00', required: false })
  @IsOptional()
  @IsString()
  preferredAt?: string;

  @ApiProperty({ example: 'Bot orqali kelgan xabar', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: 'crm', required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    example: 'Yaxshi mijoz, konsultatsiya kerak',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: LEAD_LANGS, required: false })
  @IsOptional()
  @IsIn(LEAD_LANGS, { message: "Til noto'g'ri (uz, ru yoki en)" })
  lang?: string;

  @ApiProperty({ enum: LEAD_STATUSES, required: false })
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: string;
}
