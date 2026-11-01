import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DateOnlyQuery } from '../../common/dto/pagination.dto';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Hisobot kuni (YYYY-MM-DD). Standart: bugun (Asia/Tashkent)',
  })
  @DateOnlyQuery()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description:
      'Davr boshi. `startDate`/`endDate` berilsa "oy" ko‘rsatkichlari (yangi bemorlar, daromad, xarajat) shu davr uchun hisoblanadi; berilmasa — `date` joylashgan oy',
  })
  @DateOnlyQuery()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description:
      'Davr oxiri (shu kun ham kiradi). Faqat startDate bo‘lsa — `date` gacha',
  })
  @DateOnlyQuery()
  endDate?: string;
}

export class MonthlyQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 24, default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = 6;
}

export const SOURCE_TYPES = ['bookings', 'patients'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export class SourcesQueryDto {
  @ApiPropertyOptional({
    enum: SOURCE_TYPES,
    default: 'bookings',
    description:
      'bookings — qabullar manbasi (standart); patients — bemorlar manbasi',
  })
  @IsOptional()
  @IsIn(SOURCE_TYPES)
  type?: SourceType = 'bookings';
}
